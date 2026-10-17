/**
 * 쪽을 그리는 데 필요한 항목만 남기기 (가리기에서 남기는 쪽에 쓴다).
 *
 * 쪽에서 시작해 PDF 규격의 구조(자원 → 그림·묶음 그림·글꼴·색공간 …)를 따라가며, 그 자리에서 그리기에
 * 쓰는 항목만 남기고 나머지는 모두 지운다. XMP·첨부 파일·앱 데이터·대체 그림·바깥 파일 연결처럼
 * 화면에 보이지 않지만 가린 쪽의 자료를 가리킬 수 있는 항목을 하나씩 찾아 빼는 대신, 모르는 항목은
 * 처음부터 남기지 않는다.
 */
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFStream,
  PDFString,
  type PDFContext,
  type PDFObject,
} from '@cantoo/pdf-lib';

/** 자리(역할). 그 자리의 사전에서 남길 항목과, 항목 값의 자리를 정한다 */
type Role =
  | 'value'
  | 'page'
  | 'content'
  | 'resources'
  | 'xobject'
  | 'image'
  | 'imageMask'
  | 'form'
  | 'group'
  | 'font'
  | 'encoding'
  | 'cidSystemInfo'
  | 'fontDescriptor'
  | 'fontFile'
  | 'style'
  | 'stream'
  | 'parms'
  | 'graphicsState'
  | 'stateFont'
  | 'softMask'
  | 'function'
  | 'pattern'
  | 'shading'
  | 'colorSpace'
  | 'colorSpaceItem'
  | 'icc'
  | 'process'
  | 'properties'
  /** 층 조합의 보이기 식(/VE): [/And|/Or|/Not 층 또는 다시 식 …] */
  | 'visibility'
  | { map: Role };

type Keys = Record<string, Role>;

/** 모든 스트림에 있는 항목 (바깥 파일 연결 /F·/FFilter·/FDecodeParms는 남기지 않는다) */
const STREAM: Keys = { Length: 'value', Filter: 'value', DecodeParms: 'parms', DL: 'value' };

const PAGE: Keys = {
  Type: 'value',
  Resources: 'resources',
  MediaBox: 'value',
  CropBox: 'value',
  BleedBox: 'value',
  TrimBox: 'value',
  ArtBox: 'value',
  Contents: 'content',
  Rotate: 'value',
  Group: 'group',
  UserUnit: 'value',
};

const RESOURCES: Keys = {
  XObject: { map: 'xobject' },
  Font: { map: 'font' },
  ExtGState: { map: 'graphicsState' },
  Pattern: { map: 'pattern' },
  Shading: { map: 'shading' },
  ColorSpace: { map: 'colorSpace' },
  Properties: { map: 'properties' },
  ProcSet: 'value',
};

const IMAGE: Keys = {
  ...STREAM,
  Type: 'value',
  Subtype: 'value',
  Width: 'value',
  Height: 'value',
  ColorSpace: 'colorSpace',
  BitsPerComponent: 'value',
  Intent: 'value',
  ImageMask: 'value',
  Mask: 'imageMask',
  Decode: 'value',
  Interpolate: 'value',
  SMask: 'image',
  SMaskInData: 'value',
  Matte: 'value',
  OC: 'properties',
  Name: 'value',
};

const FORM: Keys = {
  ...STREAM,
  Type: 'value',
  Subtype: 'value',
  FormType: 'value',
  BBox: 'value',
  Matrix: 'value',
  Resources: 'resources',
  Group: 'group',
  OC: 'properties',
  Name: 'value',
};

const GROUP: Keys = { Type: 'value', S: 'value', CS: 'colorSpace', I: 'value', K: 'value' };

const FONT: Keys = {
  Type: 'value',
  Subtype: 'value',
  BaseFont: 'value',
  Name: 'value',
  FirstChar: 'value',
  LastChar: 'value',
  Widths: 'value',
  FontDescriptor: 'fontDescriptor',
  Encoding: 'encoding',
  // 글자 → 유니코드 CMap. 다른 CMap을 이어받을 수 있어(/UseCMap) CMap 자리로 정리한다
  ToUnicode: 'encoding',
  DescendantFonts: 'font',
  CIDSystemInfo: 'cidSystemInfo',
  DW: 'value',
  W: 'value',
  DW2: 'value',
  W2: 'value',
  CIDToGIDMap: 'stream',
  // Type3
  FontBBox: 'value',
  FontMatrix: 'value',
  CharProcs: { map: 'stream' },
  Resources: 'resources',
};

/** 글자 인코딩: 사전(/Differences) 또는 CMap 스트림 */
const ENCODING: Keys = {
  ...STREAM,
  Type: 'value',
  BaseEncoding: 'value',
  Differences: 'value',
  CMapName: 'value',
  CIDSystemInfo: 'cidSystemInfo',
  WMode: 'value',
  UseCMap: 'encoding',
};

const CID_SYSTEM_INFO: Keys = { Registry: 'value', Ordering: 'value', Supplement: 'value' };

const FONT_DESCRIPTOR: Keys = {
  Type: 'value',
  FontName: 'value',
  FontFamily: 'value',
  FontStretch: 'value',
  FontWeight: 'value',
  Flags: 'value',
  FontBBox: 'value',
  ItalicAngle: 'value',
  Ascent: 'value',
  Descent: 'value',
  Leading: 'value',
  CapHeight: 'value',
  XHeight: 'value',
  StemV: 'value',
  StemH: 'value',
  AvgWidth: 'value',
  MaxWidth: 'value',
  MissingWidth: 'value',
  FontFile: 'fontFile',
  FontFile2: 'fontFile',
  FontFile3: 'fontFile',
  CharSet: 'value',
  Style: 'style',
  Lang: 'value',
  FD: { map: 'fontDescriptor' },
  CIDSet: 'stream',
};

const FONT_FILE: Keys = {
  ...STREAM,
  Length1: 'value',
  Length2: 'value',
  Length3: 'value',
  Subtype: 'value',
};

/** 압축 매개변수 (JBIG2 공통 자료는 스트림) */
const PARMS: Keys = {
  Predictor: 'value',
  Colors: 'value',
  BitsPerComponent: 'value',
  Columns: 'value',
  EarlyChange: 'value',
  K: 'value',
  EndOfLine: 'value',
  EncodedByteAlign: 'value',
  Rows: 'value',
  EndOfBlock: 'value',
  BlackIs1: 'value',
  DamagedRowsBeforeError: 'value',
  ColorTransform: 'value',
  JBIG2Globals: 'stream',
};

/** 그래픽 상태. 인쇄 망점(/HT)은 화면에 쓰지 않고 구조가 복잡해 남기지 않는다 */
const GRAPHICS_STATE: Keys = {
  Type: 'value',
  LW: 'value',
  LC: 'value',
  LJ: 'value',
  ML: 'value',
  D: 'value',
  RI: 'value',
  OP: 'value',
  op: 'value',
  OPM: 'value',
  Font: 'stateFont',
  BG: 'function',
  BG2: 'function',
  UCR: 'function',
  UCR2: 'function',
  TR: 'function',
  TR2: 'function',
  FL: 'value',
  SM: 'value',
  SA: 'value',
  BM: 'value',
  SMask: 'softMask',
  CA: 'value',
  ca: 'value',
  AIS: 'value',
  TK: 'value',
  UseBlackPtComp: 'value',
};

const SOFT_MASK: Keys = { Type: 'value', S: 'value', G: 'form', BC: 'value', TR: 'function' };

const FUNCTION: Keys = {
  ...STREAM,
  FunctionType: 'value',
  Domain: 'value',
  Range: 'value',
  Size: 'value',
  BitsPerSample: 'value',
  Order: 'value',
  Encode: 'value',
  Decode: 'value',
  C0: 'value',
  C1: 'value',
  N: 'value',
  Functions: 'function',
  Bounds: 'value',
};

const TILING_PATTERN: Keys = {
  ...STREAM,
  Type: 'value',
  PatternType: 'value',
  PaintType: 'value',
  TilingType: 'value',
  BBox: 'value',
  XStep: 'value',
  YStep: 'value',
  Resources: 'resources',
  Matrix: 'value',
};

const SHADING_PATTERN: Keys = {
  Type: 'value',
  PatternType: 'value',
  Shading: 'shading',
  Matrix: 'value',
  ExtGState: 'graphicsState',
};

const SHADING: Keys = {
  ...STREAM,
  ShadingType: 'value',
  ColorSpace: 'colorSpace',
  Background: 'value',
  BBox: 'value',
  AntiAlias: 'value',
  Coords: 'value',
  Domain: 'value',
  Function: 'function',
  Extend: 'value',
  Matrix: 'value',
  BitsPerCoordinate: 'value',
  BitsPerComponent: 'value',
  BitsPerFlag: 'value',
  Decode: 'value',
  VerticesPerRow: 'value',
};

/** 색공간 배열 안의 사전: 보정 색공간 값, DeviceN 속성 */
const COLOR_SPACE_DICT: Keys = {
  WhitePoint: 'value',
  BlackPoint: 'value',
  Gamma: 'value',
  Matrix: 'value',
  Range: 'value',
  Subtype: 'value',
  Colorants: { map: 'colorSpace' },
  Process: 'process',
};

const ICC: Keys = { ...STREAM, N: 'value', Alternate: 'colorSpace', Range: 'value' };

const PROCESS: Keys = { ColorSpace: 'colorSpace', Components: 'value' };

/** 보이기 층(OCG)과 그 조합(OCMD). 그 밖의 표시 내용 속성은 남기지 않는다 */
const OPTIONAL_CONTENT: Keys = {
  Type: 'value',
  Name: 'value',
  Intent: 'value',
  OCGs: 'properties',
  P: 'value',
  VE: 'visibility',
};

const isPlain = (object: PDFObject | undefined) =>
  object instanceof PDFNumber ||
  object instanceof PDFName ||
  object instanceof PDFString ||
  object instanceof PDFHexString ||
  object instanceof PDFBool ||
  object === PDFNull;

class Sanitizer {
  /** 이미 정리한 (객체, 자리) */
  private seen = new Map<object, Set<string>>();

  constructor(private context: PDFContext) {}

  /** 값을 그 자리에 맞게 정리한다. 그 자리에 올 수 없는 값이면 false (부모가 그 항목을 지운다) */
  clean(value: PDFObject | undefined, role: Role): boolean {
    const object = this.context.lookup(value);
    if (object === undefined) return false;
    if (role === 'value') return this.plain(object);
    // 사전 자리에 온 단순 값: 이름(/Identity, /None, 장치 색공간 등)은 그대로,
    // 색공간 배열 안에서는 숫자·글자(최댓값, 색 목록)도 그대로
    if (isPlain(object)) {
      return role === 'colorSpaceItem' || object instanceof PDFName || object === PDFNull;
    }
    if (object instanceof PDFArray) return this.array(object, role);
    if (!(object instanceof PDFDict) && !(object instanceof PDFStream)) return false;
    const dict = object instanceof PDFStream ? object.dict : object;
    // 그 자리에 올 수 없는 모양인지 먼저 정한다. 정리하지 못한 객체를 '본 적 있음'으로 적어 두면, 다음에 같은
    // 자리로 만났을 때 정리하지 않은 채로 남기게 된다
    if (typeof role !== 'string' && object instanceof PDFStream) return false;
    const keys =
      typeof role === 'string' ? this.keysFor(role, dict, object instanceof PDFStream) : undefined;
    if (typeof role === 'string' && !keys) return false;
    const key = typeof role === 'string' ? role : `map:${JSON.stringify(role.map)}`;
    const done = this.seen.get(object) ?? new Set<string>();
    if (done.has(key)) return true;
    done.add(key);
    this.seen.set(object, done);
    if (typeof role !== 'string') {
      for (const [name, item] of dict.entries()) {
        if (!this.clean(item, role.map)) dict.delete(name);
      }
      return true;
    }
    for (const [name, item] of dict.entries()) {
      const child = keys![name.decodeText()];
      if (child === undefined || !this.clean(item, child)) dict.delete(name);
    }
    return true;
  }

  /** 숫자·이름·글자 같은 단순 값과 그 배열만 */
  private plain(object: PDFObject): boolean {
    if (isPlain(object)) return true;
    if (!(object instanceof PDFArray)) return false;
    return object.asArray().every((item) => this.plain(this.context.lookup(item) ?? PDFNull));
  }

  /** 배열은 각 항목을 같은 자리로 본다 (내용 스트림 여러 개, 글꼴 목록 등). 색공간 배열은 따로 */
  private array(array: PDFArray, role: Role): boolean {
    if (role === 'colorSpace') {
      for (let i = 0; i < array.size(); i++) {
        if (!this.clean(array.get(i), 'colorSpaceItem')) array.set(i, PDFNull);
      }
      return true;
    }
    if (role === 'stateFont') {
      // [글꼴 크기]
      return this.clean(array.get(0), 'font') && this.plain(array.lookup(1) ?? PDFNull);
    }
    if (role === 'imageMask') return this.plain(array);
    for (let i = 0; i < array.size(); i++) {
      if (!this.clean(array.get(i), role)) array.set(i, PDFNull);
    }
    return true;
  }

  /** 자리와 사전 모양에 따라 남길 항목. 그 자리에 올 수 없는 모양이면 undefined */
  private keysFor(role: Role, dict: PDFDict, stream: boolean): Keys | undefined {
    const subtype = dict.get(PDFName.of('Subtype'));
    switch (role) {
      case 'page':
        return PAGE;
      case 'content':
      case 'stream':
        return stream ? STREAM : undefined;
      case 'resources':
        return RESOURCES;
      case 'xobject':
        if (!stream) return undefined;
        if (subtype === PDFName.of('Image')) return IMAGE;
        if (subtype === PDFName.of('Form')) return FORM;
        return undefined;
      case 'image':
      case 'imageMask':
        return stream ? IMAGE : undefined;
      case 'form':
        return stream ? FORM : undefined;
      case 'group':
        return GROUP;
      case 'font':
        return stream ? undefined : FONT;
      case 'encoding':
        return ENCODING;
      case 'cidSystemInfo':
        return CID_SYSTEM_INFO;
      case 'fontDescriptor':
        return FONT_DESCRIPTOR;
      case 'fontFile':
        return stream ? FONT_FILE : undefined;
      case 'style':
        return { Panose: 'value' };
      case 'parms':
        return PARMS;
      case 'graphicsState':
        return GRAPHICS_STATE;
      case 'softMask':
        return SOFT_MASK;
      case 'function':
        return FUNCTION;
      case 'pattern': {
        const type = dict.get(PDFName.of('PatternType'));
        if (type instanceof PDFNumber && type.asNumber() === 1) return TILING_PATTERN;
        if (type instanceof PDFNumber && type.asNumber() === 2) return SHADING_PATTERN;
        return undefined;
      }
      case 'shading':
        return SHADING;
      case 'colorSpaceItem':
        // 색 목록 표·ICC 프로필(스트림), 대체 색 바꾸기 함수, 보정 값·DeviceN 속성(사전)
        if (dict.has(PDFName.of('FunctionType'))) return FUNCTION;
        if (stream) return dict.has(PDFName.of('N')) ? ICC : STREAM;
        return COLOR_SPACE_DICT;
      case 'icc':
        return ICC;
      case 'process':
        return PROCESS;
      case 'visibility':
        // 식 안의 사전은 층(OCG)만 올 수 있다 (연산자 이름과 안쪽 식은 배열·이름이라 여기 오지 않는다)
        return dict.get(PDFName.of('Type')) === PDFName.of('OCG') ? OPTIONAL_CONTENT : undefined;
      case 'properties': {
        const type = dict.get(PDFName.of('Type'));
        if (type === PDFName.of('OCG') || type === PDFName.of('OCMD')) return OPTIONAL_CONTENT;
        // 그 밖의 표시 내용 속성은 빈 사전으로 남긴다 (내용에서 이름으로 부르므로)
        return {};
      }
      default:
        return undefined;
    }
  }
}

/** 쪽 사전(과 거기서 닿는 모든 것)에서 그리기에 필요한 항목만 남긴다. /Parent는 그대로 둔다 */
export function keepRenderingOnly(page: PDFDict) {
  const sanitizer = new Sanitizer(page.context);
  const parent = page.get(PDFName.of('Parent'));
  sanitizer.clean(page, 'page');
  if (parent) page.set(PDFName.of('Parent'), parent);
}
