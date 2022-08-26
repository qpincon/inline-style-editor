import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import filesize from "rollup-plugin-filesize";
import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import scss from 'rollup-plugin-scss';
import { visualizer } from "rollup-plugin-visualizer";
import pkg from "./package.json";

const name = pkg.name
	.replace(/^\w/, m => m.toUpperCase())
	.replace(/-\w/g, m => m[1].toUpperCase());

export default [
    {
        input: 'src/components/StyleEditor.svelte',
        output: [
        {
            file: pkg.module,
            format: 'es',
        },
        {
            file: pkg.main,
            format: 'umd',
            name: name,
            plugins: [terser()]
        }],
        plugins: [
            svelte(),
            resolve(),
            commonjs(),
            scss({
                output: pkg.style,
                outputStyle: 'compressed'
            }),
            filesize(),
            visualizer()
        ]
    },
]