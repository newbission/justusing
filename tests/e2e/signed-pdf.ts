/**
 * 전자 서명된 PDF를 흉내 낸 테스트 파일. 실제 인증서는 없지만 pdf.js가 서명으로 읽는 모양
 * (AcroForm SigFlags, 서명 칸의 /V에 ByteRange·Contents)을 갖춘다.
 */
import { PDFDocument, PDFHexString, PDFName, PDFString } from '@cantoo/pdf-lib';

export async function signedPdf(pages = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pages; index++) doc.addPage([200, 200]);
  const { context } = doc;
  const signature = context.register(
    context.obj({
      Type: 'Sig',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'adbe.pkcs7.detached',
      ByteRange: [0, 10, 20, 10],
      Contents: PDFHexString.of('5369676E65722043657274205061726B'),
      Cert: PDFString.of('Cert Holder Park'),
      Name: PDFString.of('Signer Secret Kim'),
      M: PDFString.of('D:20240505000000Z'),
    }),
  );
  const field = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      T: PDFString.of('sig_field'),
      Rect: [0, 0, 0, 0],
      F: 132,
      P: doc.getPage(0).ref,
      V: signature,
      // 서명 조건: 어떤 인증서로 서명할지 적어 둘 수 있다
      SV: context.obj({ Type: 'SV', Reason: [PDFString.of('Seed Reason Lee')] }),
    }),
  );
  doc.getPage(0).node.set(PDFName.of('Annots'), context.obj([field]));
  doc.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: [field], SigFlags: 3 }));
  // 문서 권한(DocMDP)도 같은 서명을 가리킨다
  doc.catalog.set(PDFName.of('Perms'), context.obj({ DocMDP: signature }));
  // 장기 검증(LTV) 서명은 인증서를 문서의 DSS에도 따로 담는다
  const cert = context.register(context.stream('DSS Cert Choi'));
  doc.catalog.set(
    PDFName.of('DSS'),
    context.obj({ Certs: [cert], VRI: { ABCD: { Cert: [cert] } } }),
  );
  doc.catalog.set(
    PDFName.of('Legal'),
    context.obj({ Attestation: PDFString.of('Legal Note Jung') }),
  );
  return Buffer.from(await doc.save({ updateFieldAppearances: false }));
}
