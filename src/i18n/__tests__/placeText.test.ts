import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agencyName, catalogLicense, normalizeAgency, statisticsLicense, statisticsPublisher } from '../agencyText';
import { placeName, placeNameList, placeTown } from '../placeText';

const LOCALES = join(__dirname, '..', 'locales');
function ctx(locale: 'zh-TW' | 'en' | 'ja') {
  const table: Record<string, string> = {};
  if (locale !== 'zh-TW') {
    for (const file of ['place', 'agency', 'agencySuffix', 'statPublisher', 'statLicense', 'license']) {
      Object.assign(table, JSON.parse(readFileSync(join(LOCALES, locale, `enums.${file}.json`), 'utf8')));
    }
  }
  return { active: locale, lookup: (key: string) => table[key] ?? null } as never;
}
const zh = ctx('zh-TW'), en = ctx('en'), ja = ctx('ja');

describe('placeName', () => {
  it('中文介面原樣回傳', () => {
    expect(placeName('臺北市', zh)).toBe('臺北市');
    expect(placeName('東區', zh, '66000020')).toBe('東區');
  });
  it('縣市與鄉鎮：英文用內政部羅馬拼音、日文用新字體', () => {
    expect(placeName('臺北市', en)).toBe('Taipei City');
    expect(placeName('新竹縣', en)).toBe('Hsinchu County');
    expect(placeName('板橋區', en)).toBe('Banqiao District');
    expect(placeName('臺北市', ja)).toBe('台北市');
    expect(placeName('新竹縣', ja)).toBe('新竹県');
    expect(placeName('板橋區', ja)).toBe('板橋区');
    expect(placeName('信義鄉', ja)).toBe('信義郷');
    expect(placeName('頭份市', en)).toBe('Toufen City');
  });
  it('台／臺兩種寫法都查得到', () => {
    expect(placeName('台北市', en)).toBe('Taipei City');
    expect(placeName('台南市', ja)).toBe('台南市');
    expect(placeName('台東縣', en)).toBe('Taitung County');
  });
  it('同名鄉鎮：有代碼用代碼，連寫用縣市消歧義', () => {
    // 三個縣市都有「東區」，名稱相同譯名也相同，所以單獨名稱查得到
    expect(placeName('東區', en)).toBe('East District');
    expect(placeName('東區', en, '66000020')).toBe('East District');
    // 代碼優先（8 碼鄉鎮、5 碼縣市）
    expect(placeName('中正區', en, '63000050')).toBe('Zhongzheng District');
    expect(placeName('中正區', en, '10017010')).toBe('Zhongzheng District');
    expect(placeName('中正區', ja, '10017010')).toBe('中正区');
    expect(placeName('臺北市中正區', en)).toBe('Zhongzheng District, Taipei City');
    expect(placeName('基隆市中正區', en)).toBe('Zhongzheng District, Keelung City');
    expect(placeName('台北市大安區', ja)).toBe('台北市大安区');
    expect(placeTown('臺南市', '東區', en)).toBe('East District');
    expect(placeTown('臺北市', '中正區', ja)).toBe('中正区');
    expect(placeName('三民區', en, '64000050')).toBe('Sanmin District');
  });
  it('查不到就退回原文，不含中文的原樣', () => {
    expect(placeName('火星市', en)).toBe('火星市');
    expect(placeName('火星市', ja, '99999')).toBe('火星市');
    expect(placeName('Taipei', en)).toBe('Taipei');
    expect(placeName('', en)).toBe('');
    expect(placeTown('臺北市', '火星區', en)).toBe('火星區');
  });
  it('地名清單', () => {
    expect(placeNameList('臺北市、新北市', en)).toBe('Taipei City, New Taipei City');
    expect(placeNameList('台北市／基隆市', ja)).toBe('台北市、基隆市');
    expect(placeNameList('臺北市、不明地', en)).toBe('Taipei City, 不明地');
    expect(placeNameList('臺北市、新北市', zh)).toBe('臺北市、新北市');
  });
});

describe('對照表完整性', () => {
  const read = (locale: string) => JSON.parse(readFileSync(join(LOCALES, locale, 'enums.place.json'), 'utf8')) as Record<string, string>;
  for (const locale of ['en', 'ja']) {
    it(`${locale}: 22 縣市＋368 鄉鎮市區皆有代碼譯名`, () => {
      const codes = Object.keys(read(locale)).filter((key) => /^enum\.place\.\d+$/.test(key));
      expect(codes.filter((key) => key.length === 'enum.place.'.length + 5)).toHaveLength(22);
      expect(codes.filter((key) => key.length === 'enum.place.'.length + 8)).toHaveLength(368);
    });
  }
});

describe('agencyName / statisticsPublisher', () => {
  it('正規化：台臺、空白、結尾英文括號', () => {
    expect(normalizeAgency('經濟部水利署 (WRA)')).toBe('經濟部水利署');
    expect(normalizeAgency('內政部國土測繪中心（NLSC）')).toBe('內政部國土測繪中心');
    expect(normalizeAgency('台灣電力公司')).toBe('臺灣電力公司');
  });
  it('常見機關與縣市政府局處', () => {
    expect(agencyName('經濟部水利署 (WRA)', en)).toBe('Water Resources Agency, Ministry of Economic Affairs');
    expect(agencyName('台灣電力公司', en)).toBe('Taiwan Power Company (Taipower)');
    expect(agencyName('高雄市政府消防局', en)).toBe('Kaohsiung City Fire Department');
    expect(agencyName('臺北市政府', ja)).toBe('台北市政府');
    expect(agencyName('新北市環保局', ja)).toBe('新北市環境保護局');
    expect(agencyName('環境部、農業部', en)).toBe('Ministry of Environment; Ministry of Agriculture');
  });
  it('統計發布機關：整句優先、主計總處用官方英文名', () => {
    expect(statisticsPublisher('行政院主計總處', en)).toBe('Directorate-General of Budget, Accounting and Statistics (DGBAS)');
    expect(statisticsPublisher('行政院主計總處', ja)).toBe('行政院主計総処');
    expect(statisticsPublisher('金融監督管理委員會銀行局（資料製作：財團法人聯合信用卡處理中心）', en)).toContain('Banking Bureau');
  });
  it('查不到退回原文；中文介面原樣；純英文原樣', () => {
    expect(agencyName('某某不存在的單位', en)).toBe('某某不存在的單位');
    expect(agencyName('環境部、不存在的單位', en)).toBe('環境部、不存在的單位');
    expect(statisticsPublisher('環境部', zh)).toBe('環境部');
    expect(agencyName('OpenStreetMap contributors', ja)).toBe('OpenStreetMap contributors');
  });
});

describe('授權', () => {
  it('政府資料開放授權的各種寫法歸成同一類', () => {
    const label = 'Open Government Data License, Version 1.0 (Taiwan OGDL)';
    for (const raw of ['政府資料開放授權條款-第1版', '政府資料開放授權條款－第1版', '政府資料開放授權條款第 1 版', '政府資料開放授權條款-第 1 版', '政府資料開放授權條款 1.0（OGDL-Taiwan-1.0）', 'OGDL-Taiwan-1.0', 'OGDL-Taiwan-1.0（政府資料開放授權條款 1.0）', '政府資料開放授權條款第 1 版。', '政府資料開放授權 OGDL-Taiwan-1.0']) {
      expect(catalogLicense(raw, en), raw).toBe(label);
      expect(statisticsLicense(raw, en), raw).toBe(label);
    }
    expect(catalogLicense('OGDL-Taiwan-1.0', ja)).toBe('政府データオープンライセンス第1版（台湾 OGDL）');
  });
  it('CC BY、CC BY-SA、ODbL、未標示', () => {
    expect(catalogLicense('CC BY 4.0', en)).toBe('CC BY 4.0 (Attribution)');
    expect(catalogLicense('CC-BY-4.0', ja)).toBe('CC BY 4.0（表示）');
    expect(catalogLicense('CC BY-SA 4.0', en)).toBe('CC BY-SA (Attribution-ShareAlike) 4.0');
    expect(catalogLicense('ODbL（Open Database License）', en)).toBe('Open Database License (ODbL) 1.0');
    expect(catalogLicense('ODbL 1.0', ja)).toBe('オープンデータベースライセンス（ODbL）1.0');
    expect(catalogLicense('unknown', en)).toBe('Not specified');
  });
  it('帶註記的長句：統計整句查表，其他退回原文，不把註記吃掉', () => {
    expect(statisticsLicense('政府網站資料開放宣告（未逐字確認；上線前補查）', en)).toContain('not verified');
    expect(statisticsLicense('政府資料開放授權條款第 1 版（依 data.gov.tw 8571 資料集頁標示）', en)).toContain('dataset 8571');
    const note = '政府資料開放授權條款-第1版（receipt 記 https://data.gov.tw/license，未逐站核對）';
    expect(catalogLicense(note, en)).toBe(note);
    expect(statisticsLicense('某種未知授權', en)).toBe('某種未知授權');
  });
  it('中文介面原樣', () => {
    expect(statisticsLicense('政府資料開放授權條款-第1版', zh)).toBe('政府資料開放授權條款-第1版');
    expect(catalogLicense('OGDL-Taiwan-1.0', zh)).toBe('OGDL-Taiwan-1.0');
  });
});
