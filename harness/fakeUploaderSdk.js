// QA-only stand-in for @printcart/uploader-sdk. Lets the harness page trigger
// "upload-success" without a real file-picker/upload UI. Never shipped —
// only referenced by vite.harness.config.js alias, not by the real build.
export default class FakeUploader {
  constructor(opts) {
    this.opts = opts;
    this._handlers = {};
    window.__pcFakeUploader = this;
  }

  on(event, cb) {
    this._handlers[event] = this._handlers[event] || [];
    this._handlers[event].push(cb);
  }

  emit(event, payload) {
    (this._handlers[event] || []).forEach((cb) => cb(payload));
  }

  open() {
    window.__pcUploaderOpenCount = (window.__pcUploaderOpenCount || 0) + 1;
  }

  close() {
    window.__pcUploaderCloseCount = (window.__pcUploaderCloseCount || 0) + 1;
  }
}
