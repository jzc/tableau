const path = require("path")
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require("webpack-merge");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const common = {
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/i,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
	test: /\.css$/i,
	// use: ["style-loader", "css-loader"],
	use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
	test: /\.html$/i,
	use: ["html-loader", path.resolve("katex-loader.js")],
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'tableau',
    }),
    new MiniCssExtractPlugin(),
    // new BundleAnalyzerPlugin(),
  ],
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },  
  // optimization: { splitChunks: { chunks: "all" } },
};

const dev = {
  name: "dev",
  mode: "development",
  devtool: "inline-source-map",
}

const prod = {
  name: "prod",
  mode: "production",
}

module.exports = [
  merge(common, dev),
  merge(common, prod),
];
