import { describe,expect,it } from "vitest";
import { billDisplayStatus } from "./domain";

const boundary=new Date("2026-09-09T18:30:00.000Z");
describe("billDisplayStatus",()=>{
  it("derives Bangkok upcoming/due/overdue",()=>{
    expect(billDisplayStatus("OPEN","2026-09-11",boundary)).toBe("UPCOMING");
    expect(billDisplayStatus("OPEN","2026-09-10",boundary)).toBe("DUE");
    expect(billDisplayStatus("OPEN","2026-09-09",boundary)).toBe("OVERDUE");
  });
  it("keeps stable terminal states",()=>{
    expect(billDisplayStatus("PAID","2020-01-01",boundary)).toBe("PAID");
    expect(billDisplayStatus("SKIPPED","2030-01-01",boundary)).toBe("SKIPPED");
  });
});
