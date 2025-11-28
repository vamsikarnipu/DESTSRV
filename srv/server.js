const cds = require("@sap/cds");
const cov2ap = require("@cap-js-community/odata-v2-adapter");
const express = require("express");
const path = require("path");

process.on("warning", e => console.warn(e.stack));
require("events").EventEmitter.prototype._maxListeners = 15;

cds.on("bootstrap", app => {

  // ODATA V2 adapter
  app.use(
    cov2ap({
      path: "/odata/v2",
      targetPath: "/odata/v4"
    })
  );

  // STATIC JS LIBRARY (NEW)
  app.use(
    "/resources/ui5Lib",
    express.static(path.join(__dirname, "static/ui5Lib"))
  );

});

module.exports = cds.server;