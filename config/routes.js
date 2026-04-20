/**
 * 監視対象の高速道路ルート設定
 * 東京〜名古屋間: 東名高速 / 中央道 / 圏央道
 *
 * HERE Traffic APIのflow endpoint用に
 * 各区間をIC間の座標ポイントで定義する
 */

const ROUTES = [
  {
    id: "tomei_down",
    name: "東名高速",
    direction: "下り（東京→名古屋）",
    segments: [
      {
        name: "東京IC → 横浜町田IC",
        from: "東京IC",
        to: "横浜町田IC",
        // HERE API用: 始点・終点の緯度経度
        origin: { lat: 35.6197, lng: 139.7396 },
        destination: { lat: 35.5279, lng: 139.4488 },
        normalMinutes: 20,
      },
      {
        name: "横浜町田IC → 厚木IC",
        from: "横浜町田IC",
        to: "厚木IC",
        origin: { lat: 35.5279, lng: 139.4488 },
        destination: { lat: 35.4432, lng: 139.3228 },
        normalMinutes: 12,
      },
      {
        name: "厚木IC → 御殿場JCT",
        from: "厚木IC",
        to: "御殿場JCT",
        origin: { lat: 35.4432, lng: 139.3228 },
        destination: { lat: 35.2992, lng: 138.9349 },
        normalMinutes: 35,
      },
      {
        name: "御殿場JCT → 富士IC",
        from: "御殿場JCT",
        to: "富士IC",
        origin: { lat: 35.2992, lng: 138.9349 },
        destination: { lat: 35.1827, lng: 138.6856 },
        normalMinutes: 17,
      },
      {
        name: "富士IC → 静岡IC",
        from: "富士IC",
        to: "静岡IC",
        origin: { lat: 35.1827, lng: 138.6856 },
        destination: { lat: 34.9762, lng: 138.4096 },
        normalMinutes: 22,
      },
      {
        name: "静岡IC → 浜松IC",
        from: "静岡IC",
        to: "浜松IC",
        origin: { lat: 34.9762, lng: 138.4096 },
        destination: { lat: 34.7445, lng: 137.7468 },
        normalMinutes: 40,
      },
      {
        name: "浜松IC → 豊川IC",
        from: "浜松IC",
        to: "豊川IC",
        origin: { lat: 34.7445, lng: 137.7468 },
        destination: { lat: 34.8167, lng: 137.3833 },
        normalMinutes: 25,
      },
      {
        name: "豊川IC → 名古屋IC",
        from: "豊川IC",
        to: "名古屋IC",
        origin: { lat: 34.8167, lng: 137.3833 },
        destination: { lat: 35.1644, lng: 137.0444 },
        normalMinutes: 30,
      },
    ],
  },
  {
    id: "chuo_down",
    name: "中央道",
    direction: "下り（調布→名古屋）",
    segments: [
      {
        name: "調布IC → 八王子IC",
        from: "調布IC",
        to: "八王子IC",
        origin: { lat: 35.6509, lng: 139.5448 },
        destination: { lat: 35.6333, lng: 139.2667 },
        normalMinutes: 22,
      },
      {
        name: "八王子IC → 大月JCT",
        from: "八王子IC",
        to: "大月JCT",
        origin: { lat: 35.6333, lng: 139.2667 },
        destination: { lat: 35.5933, lng: 138.9381 },
        normalMinutes: 30,
      },
      {
        name: "大月JCT → 甲府昭和IC",
        from: "大月JCT",
        to: "甲府昭和IC",
        origin: { lat: 35.5933, lng: 138.9381 },
        destination: { lat: 35.6667, lng: 138.5333 },
        normalMinutes: 32,
      },
      {
        name: "甲府昭和IC → 諏訪IC",
        from: "甲府昭和IC",
        to: "諏訪IC",
        origin: { lat: 35.6667, lng: 138.5333 },
        destination: { lat: 36.0333, lng: 138.0833 },
        normalMinutes: 42,
      },
      {
        name: "諏訪IC → 伊那IC",
        from: "諏訪IC",
        to: "伊那IC",
        origin: { lat: 36.0333, lng: 138.0833 },
        destination: { lat: 35.8281, lng: 137.9542 },
        normalMinutes: 22,
      },
      {
        name: "伊那IC → 飯田IC",
        from: "伊那IC",
        to: "飯田IC",
        origin: { lat: 35.8281, lng: 137.9542 },
        destination: { lat: 35.5167, lng: 137.85 },
        normalMinutes: 35,
      },
      {
        name: "飯田IC → 中津川IC",
        from: "飯田IC",
        to: "中津川IC",
        origin: { lat: 35.5167, lng: 137.85 },
        destination: { lat: 35.5028, lng: 137.4722 },
        normalMinutes: 30,
      },
      {
        name: "中津川IC → 小牧JCT",
        from: "中津川IC",
        to: "小牧JCT",
        origin: { lat: 35.5028, lng: 137.4722 },
        destination: { lat: 35.2928, lng: 136.9167 },
        normalMinutes: 40,
      },
    ],
  },
  {
    id: "kento_down",
    name: "圏央道",
    direction: "（関連区間）",
    segments: [
      {
        name: "海老名JCT → 相模原愛川IC",
        from: "海老名JCT",
        to: "相模原愛川IC",
        origin: { lat: 35.4553, lng: 139.3906 },
        destination: { lat: 35.5522, lng: 139.3278 },
        normalMinutes: 11,
      },
      {
        name: "相模原愛川IC → 八王子JCT",
        from: "相模原愛川IC",
        to: "八王子JCT",
        origin: { lat: 35.5522, lng: 139.3278 },
        destination: { lat: 35.6408, lng: 139.2592 },
        normalMinutes: 16,
      },
      {
        name: "八王子JCT → 狭山日高IC",
        from: "八王子JCT",
        to: "狭山日高IC",
        origin: { lat: 35.6408, lng: 139.2592 },
        destination: { lat: 35.8667, lng: 139.3333 },
        normalMinutes: 25,
      },
      {
        name: "狭山日高IC → 鶴ヶ島JCT",
        from: "狭山日高IC",
        to: "鶴ヶ島JCT",
        origin: { lat: 35.8667, lng: 139.3333 },
        destination: { lat: 35.9333, lng: 139.3833 },
        normalMinutes: 10,
      },
    ],
  },
];

module.exports = { ROUTES };
