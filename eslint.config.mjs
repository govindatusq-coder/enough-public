import nextConfig from 'eslint-config-next';
export default [
 ...nextConfig,
 {ignores:['.next/**','node_modules/**','native/**','ios/**','vendor/**','public/**']},
];
