/** One element a custom rule reports. `selector` is a full path from <html> (like axe ancestry). */
export type CustomFinding = {
  selector: string;
  html: string;
  failureSummary: string;
};
