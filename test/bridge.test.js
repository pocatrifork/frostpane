// Exercises the hand-rolled WebSocket server: handshake, masked client frames,
// server frames, origin/path rejection, ping/pong, big-ish payloads.
var http = require("http"), crypto = require("crypto"), net = require("net");
var { createBridge, PORTS, PATH } = require(require("path").join(__dirname, "..", "installer", "assets", "frostpane-theme", "bridge.js"));

var got = [];
var bridge = createBridge({
  onHello: function (c) { c.send({ type: "hello", folder: "glass-theme", hasWorkspace: true }); },
  onMessage: function (m, c) { got.push(m); if (m.type === "state") c.send({ type: "state", accent: "#6cb4ff", pad: "x".repeat(400) }); },
});

function frame(text) {                        // client -> server, masked
  var body = Buffer.from(text, "utf8"), mask = crypto.randomBytes(4);
  var head = body.length < 126 ? Buffer.from([0x81, 0x80 | body.length])
    : Buffer.concat([Buffer.from([0x81, 0xfe]), (function(){var b=Buffer.alloc(2);b.writeUInt16BE(body.length);return b;})()]);
  var masked = Buffer.from(body);
  for (var i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
  return Buffer.concat([head, mask, masked]);
}

function readFrames(buf) {                    // server -> client, unmasked
  var out = [], i = 0;
  while (i + 2 <= buf.length) {
    var op = buf[i] & 0x0f, len = buf[i+1] & 0x7f, off = i + 2;
    if (len === 126) { len = buf.readUInt16BE(i+2); off = i + 4; }
    if (buf.length < off + len) break;
    out.push({ op: op, body: buf.slice(off, off + len).toString("utf8") });
    i = off + len;
  }
  return out;
}

function connect(port, opts, cb) {
  var key = crypto.randomBytes(16).toString("base64");
  var s = net.connect(port, "127.0.0.1", function () {
    s.write("GET " + (opts.path || PATH) + " HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\n" +
            "Connection: Upgrade\r\nSec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n" +
            (opts.origin === null ? "" : "Origin: " + (opts.origin || "vscode-file://vscode-app") + "\r\n") + "\r\n");
  });
  var buf = Buffer.alloc(0), handshook = false;
  s.on("data", function (d) {
    buf = Buffer.concat([buf, d]);
    if (!handshook) {
      var i = buf.indexOf("\r\n\r\n");
      if (i < 0) return;
      var head = buf.slice(0, i).toString();
      handshook = true;
      buf = buf.slice(i + 4);
      cb(null, { socket: s, status: head.split("\r\n")[0], accept: /sec-websocket-accept: (.*)/i.exec(head), key: key,
                 frames: function () { return readFrames(buf); } });
      return;
    }
  });
  s.on("error", function (e) { cb(e); });
  s.on("close", function () { if (!handshook) cb(new Error("closed without handshake")); });
}

var fails = 0;
function ok(cond, name) { console.log((cond ? "ok  " : "FAIL") + "  " + name); if (!cond) fails++; }

bridge.start().then(function (port) {
  ok(PORTS.indexOf(port) >= 0, "listens on a port in the range (" + port + ")");

  connect(port, {}, function (err, c) {
    if (err) { ok(false, "handshake: " + err.message); return done(); }
    ok(/101/.test(c.status), "101 Switching Protocols");
    var expect = crypto.createHash("sha1").update(c.key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    ok(c.accept && c.accept[1].trim() === expect, "Sec-WebSocket-Accept is correct");

    setTimeout(function () {
      ok(c.frames().some(function (f) { return f.op === 1 && JSON.parse(f.body).type === "hello"; }), "server greets with hello");
      c.socket.write(frame(JSON.stringify({ type: "set", accent: "#ff8800" })));
      c.socket.write(frame(JSON.stringify({ type: "state" })));
      c.socket.write(Buffer.concat([Buffer.from([0x89, 0x80]), crypto.randomBytes(4)]));   // ping
      setTimeout(function () {
        ok(got.length === 2 && got[0].accent === "#ff8800", "masked client frames decode (" + JSON.stringify(got[0]) + ")");
        var fs2 = c.frames();
        ok(fs2.some(function (f) { return f.op === 1 && f.body.length > 400; }), "16-bit length server frame decodes");
        ok(fs2.some(function (f) { return f.op === 10; }), "ping answered with pong");
        ok(bridge.count() === 1, "one client tracked");

        connect(port, { origin: "https://evil.example" }, function (e2, c2) {
          ok(!!e2 || !/101/.test(c2.status), "foreign Origin rejected");
          connect(port, { path: "/nope" }, function (e3, c3) {
            ok(!!e3 || !/101/.test(c3.status), "wrong path rejected");
            done();
          });
        });
      }, 120);
    }, 120);
  });
});

function done() {
  bridge.dispose();
  console.log(fails ? "\n" + fails + " failure(s)" : "\nall bridge tests passed");
  process.exit(fails ? 1 : 0);
}
