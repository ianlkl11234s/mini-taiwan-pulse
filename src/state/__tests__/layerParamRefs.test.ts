import { describe, expect, it } from "vitest";

import { MULTI_SELECT_ALL, MULTI_SELECT_NONE, serializeMultiSelectValues } from "../../data/layerParamsSpec";
import { enabledBusCitiesOf } from "../layerParamRefs";

describe("enabledBusCitiesOf", () => {
  it("解析預設 JSON 多選值，維持雙北初始 payload 範圍", () => {
    expect(enabledBusCitiesOf({ busGroups: serializeMultiSelectValues(["TaipeiMetro"]) }))
      .toEqual(["Taipei", "NewTaipei"]);
  });

  it("支援全選與全關，且群組與城市都依 SSOT 順序展開", () => {
    expect(enabledBusCitiesOf({ busGroups: MULTI_SELECT_NONE })).toEqual([]);
    expect(enabledBusCitiesOf({ busGroups: MULTI_SELECT_ALL })).toEqual([
      "Taipei", "NewTaipei", "Keelung", "YilanCounty",
      "Taoyuan", "Hsinchu", "HsinchuCounty", "MiaoliCounty",
      "Taichung", "ChanghuaCounty", "NantouCounty",
      "YunlinCounty", "Chiayi", "ChiayiCounty", "Tainan",
      "Kaohsiung", "PingtungCounty", "HualienCounty", "TaitungCounty",
      "PenghuCounty", "KinmenCounty", "LienchiangCounty",
    ]);
  });

  it("忽略未知值與重複值，仍依 BUS_GROUP_ORDER 展開", () => {
    expect(enabledBusCitiesOf({
      busGroups: '["Kaoping","unknown","TaipeiMetro","Kaoping"]',
    })).toEqual(["Taipei", "NewTaipei", "Kaohsiung", "PingtungCounty"]);
  });
});
