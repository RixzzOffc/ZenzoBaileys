"use strict";

const WAProto = require("../../WAProto");
const SocketMod = require("./Socket");
const makeWASocket = SocketMod.default || SocketMod;

const mod = {};

Object.assign(mod, WAProto);
Object.assign(mod, require("./Utils"));
Object.assign(mod, require("./Types"));
Object.assign(mod, require("./Store"));
Object.assign(mod, require("./Defaults"));
Object.assign(mod, require("./WABinary"));
Object.assign(mod, require("./WAM"));
Object.assign(mod, require("./WAUSync"));
Object.assign(mod, require("./Api"));
Object.assign(mod, require("./Auth"));

mod.proto = WAProto.proto;
mod.makeWASocket = makeWASocket;
mod.default = makeWASocket;

module.exports = mod;
