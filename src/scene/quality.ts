import type { Quality } from "../types";
export const QUALITY_LEVELS: Quality[] = ["low", "balanced", "high"];
export class QualityController {
  constructor(A: boolean) {
    this.mobile = A;
    A || (this.value = "high");
  }
  mobile: boolean;
  value: Quality = "balanced";
  meanMs = 16.7;
  slowSince = 0;
  fastSince = 0;
  changedAt = 0;
  samples = 0;
  observe(A: number, i: number) {
    if (
      !Number.isFinite(A) ||
      A <= 0 ||
      (this.mobile && A > 5e3) ||
      ((this.meanMs = this.samples++ === 0 ? A : this.meanMs * 0.92 + A * 0.08),
      !this.mobile) ||
      this.samples < 8
    )
      return false;
    let I = this.mobile ? 40 : 28,
      E = this.mobile ? 22 : 15;
    if (
      (this.meanMs > I
        ? ((this.slowSince ||= i), (this.fastSince = 0))
        : this.meanMs < E
          ? ((this.fastSince ||= i), (this.slowSince = 0))
          : ((this.fastSince = 0), (this.slowSince = 0)),
      i - this.changedAt < 5e3)
    )
      return false;
    let e = QUALITY_LEVELS.indexOf(this.value);
    if (this.slowSince && i - this.slowSince >= 2e3 && e > 0)
      this.value = QUALITY_LEVELS[e - 1];
    else if (this.fastSince && i - this.fastSince >= 8e3 && e < 2)
      this.value = QUALITY_LEVELS[e + 1];
    else return false;
    this.changedAt = i;
    this.fastSince = this.slowSince = 0;
    return true;
  }
}
