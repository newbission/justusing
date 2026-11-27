/** 도구마다 결과를 넘길 수 있는 도구 (src/integrations/tool-chain.ts가 meta.ts의 sendTo·receives에서 만든다) */
declare module 'virtual:tool-chain' {
  const chains: Record<
    string,
    {
      id: string;
      name: Record<'ko' | 'en', string>;
      /** 여러 장을 한꺼번에 받는지 */
      multiple: boolean;
    }[]
  >;
  export default chains;
}
