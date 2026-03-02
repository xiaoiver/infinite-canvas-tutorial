import { parseDrawIO } from 'mxgraphdata';

export const parseMxgraphDataToSerializedNodes = async (definition: string) => {
  const result = await parseDrawIO(definition);

  console.log(result);
}