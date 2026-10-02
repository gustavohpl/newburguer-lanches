// Deixa um .glb leve para o site (celular): simplifica a malha, texturas em WebP e geometria compactada (meshopt).
//   node scripts/otimizar-glb.mjs entrada.glb saida.glb [fracao_triangulos=0.15]
// O site abre meshopt sem baixar nada de fora (o decodificador vem junto do drei/three).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, textureCompress, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [entrada, saida, fracao = '0.15'] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('uso: node scripts/otimizar-glb.mjs entrada.glb saida.glb [fracao_triangulos]');
  process.exit(1);
}
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(entrada);

const triangulos = () => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);
const antes = triangulos();

await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(fracao), error: 0.0008 }),
  // faixas laterais são compridas (8:1): 2048 px; o resto (topos, fundos, folhas) 1024 px
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 82, pattern: /lateral/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(saida, doc);
const mb = (f) => (statSync(f).size / 1e6).toFixed(1);
console.log(`triângulos ${Math.round(antes / 1000)} mil → ${Math.round(triangulos() / 1000)} mil | ${mb(entrada)} MB → ${mb(saida)} MB`);
