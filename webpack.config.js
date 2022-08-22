const path = require('path');
const webpack = require('webpack');


module.exports = {
  
  entry: {
    'index': [ './src/index.js' ]
  },
  resolve: {
        alias: {
            svelte: path.resolve('node_modules', 'svelte')
        },
        extensions: ['.mjs', '.js', '.svelte'],
        mainFields: ['svelte', 'browser', 'module', 'main']
    },
  output: {
    path: __dirname + '/public',
    filename: '[name].js',
    chunkFilename: '[name].[id].js'
  },
  module: {
    rules: [
      {
          test: /\.s[ac]ss$/i,
          use: [ "style-loader", "css-loader", "sass-loader"],
          exclude: /node_modules/
      },
      {
        test: /\.(html|svelte)$/,
        use: {
          loader: 'svelte-loader',
        }
      },
      {
        test: /\.(svg|png|xlsx|csv)$/,
        type: 'asset/inline',
      },
    ]
  },
}