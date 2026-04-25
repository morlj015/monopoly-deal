export class DomainRuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainRuleViolation";
  }
}
