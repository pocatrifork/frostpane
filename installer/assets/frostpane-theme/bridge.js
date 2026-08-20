"use strict";

// A loopback WebSocket server, so the injected popup can reach the extension.
//
// The popup lives in the workbench renderer, which is sandboxed - no fs, no
// require - and the workbench Content-Security-Policy allows it exactly one
// outbound protocol:
//
//   connect-src 'self' https: ws:
//
// so http://127.0.0.1 is blocked, https://127.0.0.1 dies on the self-signed
// certificate, and ws: is the only door left. The extension host has no ws
// module, so the handshake and the framing are done here by hand. That is
// cheap: every message is a few dozen bytes of JSON, so single-frame text is
// the only case that has to work.
//
// Guards, since anything on the machine could knock: the listener binds to
// 127.0.0.1 only, the Origin must be the workbench itself, and the path must be
// ours. A page in a browser cannot forge that Origin.

var http = require("http");
var crypto = require("crypto");

var GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
var PATH = "/frostpane";
var ORIGINS = ["vscode-file://vscode-app"];
// One port per window. A second window's extension host takes the next free
// one, and the popup finds its own by asking each in turn who it belongs to.
var PORTS = [39847, 39848, 39849, 39850, 39851, 39852, 39853, 39854, 39855, 39856];
var MAX_FRAME = 1 << 16;

function accept(key) {
  return crypto.createHash("sha1").update(key + GUID).digest("base64");
}

// Server -> client frames are never masked. Two length forms cover everything
// we send; anything larger than 64KB is a bug, not a message.
function encode(text) {
  var body = Buffer.from(text, "utf8");
  var head;
  if (body.length < 126) {
    head = Buffer.from([0x81, body.length]);
  } else {
    head = Buffer.alloc(4);
    head[0] = 0x81; head[1] = 126;
    head.writeUInt16BE(body.length, 2);
  }
  return Buffer.concat([head, body]);
}

// Returns the number of bytes consumed, or 0 when the frame is still partial.
// Client frames must be masked, per the protocol.
function readFrame(buf) {
  if (buf.length < 2) return null;
  var fin = (buf[0] & 0x80) !== 0;
  var opcode = buf[0] & 0x0f;
  var masked = (buf[1] & 0x80) !== 0;
  var len = buf[1] & 0x7f;
  var offset = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    return { fatal: true };            // 64-bit lengths: not for this protocol
  }
  if (len > MAX_FRAME) return { fatal: true };
  var maskKey = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    maskKey = buf.slice(offset, offset + 4);
    offset += 4;
  }
  if (buf.length < offset + len) return null;
  var body = Buffer.from(buf.slice(offset, offset + len));
  if (maskKey) {
    for (var i = 0; i < body.length; i++) body[i] = body[i] ^ maskKey[i % 4];
  }
  return { fin: fin, opcode: opcode, body: body, size: offset + len };
}

function listen(server, ports, i) {
  return new Promise(function (resolve, reject) {
    if (i >= ports.length) { reject(new Error("no free port in the Frostpane range")); return; }
    function onError(err) {
      server.removeListener("listening", onOk);
      if (err && (err.code === "EADDRINUSE" || err.code === "EACCES")) {
        listen(server, ports, i + 1).then(resolve, reject);
      } else reject(err);
    }
    function onOk() {
      server.removeListener("error", onError);
      resolve(ports[i]);
    }
    server.once("error", onError);
    server.once("listening", onOk);
    server.listen(ports[i], "127.0.0.1");
  });
}

// opts.onMessage(msg, client)  - a parsed JSON message arrived
// opts.onHello(client)         - a popup finished connecting
function createBridge(opts) {
  var clients = [];
  var server = http.createServer(function (req, res) {
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("frostpane: websocket only\n");
  });

  server.on("upgrade", function (req, socket) {
    var origin = req.headers.origin || "";
    var url = (req.url || "").split("?")[0];
    var key = req.headers["sec-websocket-key"];
    if (url !== PATH || !key || ORIGINS.indexOf(origin) < 0) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: " + accept(key) + "\r\n\r\n"
    );
    socket.setNoDelay(true);

    var client = {
      socket: socket,
      send: function (obj) {
        try { socket.write(encode(JSON.stringify(obj))); } catch (e) {}
      },
    };
    clients.push(client);

    var buf = Buffer.alloc(0);
    socket.on("data", function (chunk) {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        var frame = readFrame(buf);
        if (!frame) return;
        if (frame.fatal) { socket.destroy(); return; }
        buf = buf.slice(frame.size);
        if (frame.opcode === 0x8) { socket.end(); return; }
        if (frame.opcode === 0x9) {                        // ping -> pong
          try { socket.write(Buffer.concat([Buffer.from([0x8a, frame.body.length]), frame.body])); } catch (e) {}
          continue;
        }
        if (frame.opcode !== 0x1 || !frame.fin) continue;   // text frames only
        var msg = null;
        try { msg = JSON.parse(frame.body.toString("utf8")); } catch (e) { continue; }
        if (msg && opts.onMessage) opts.onMessage(msg, client);
      }
    });

    var drop = function () {
      var i = clients.indexOf(client);
      if (i >= 0) clients.splice(i, 1);
    };
    socket.on("close", drop);
    socket.on("error", drop);
    if (opts.onHello) opts.onHello(client);
  });

  return {
    start: function () {
      return listen(server, PORTS, 0);
    },
    // The popup is told who it is talking to and decides whether that is its
    // own window, so two open windows cannot pick for each other.
    send: function (obj) {
      clients.slice().forEach(function (c) { c.send(obj); });
    },
    count: function () { return clients.length; },
    dispose: function () {
      clients.slice().forEach(function (c) { try { c.socket.destroy(); } catch (e) {} });
      clients.length = 0;
      try { server.close(); } catch (e) {}
    },
  };
}

module.exports = { createBridge: createBridge, PORTS: PORTS, PATH: PATH };
