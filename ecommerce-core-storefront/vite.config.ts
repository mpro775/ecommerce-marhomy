function localDependency(path:string):string{
  return decodeURIComponent(new URL(path,import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
}
export default {
  resolve:{alias:{
    react:localDependency('../ecommerce-core-admin/node_modules/react'),
    'react-dom':localDependency('../ecommerce-core-admin/node_modules/react-dom'),
  }},
  server:{port:5174,proxy:{'/api':{target:'http://localhost:3000',changeOrigin:true}}},
};
