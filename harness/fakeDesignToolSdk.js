// QA-only stand-in for @printcart/design-tool-sdk (unused in the intake
// scenarios — enable_design is false in the harness fixture — but the real
// module is imported unconditionally at the top of main.ts, so it must
// resolve to something inert).
export default class FakeDesigner {
  constructor(opts) {
    this.opts = opts;
  }

  on() {}
  render() {}
  close() {}
  editDesign() {}
}
