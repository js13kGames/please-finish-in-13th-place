import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import express from 'express'
import compression from 'compression'
import {minify as terserMinify} from 'terser'

async function getHtml({ minify = true }) {
    let html = readFileSync('index.html').toString()
    if (!minify) return html

    const [htmlBody, scripts] = html.split(/<!--\s*snip\s*-->/i)

    const scriptsObj = {}
    scripts.replace(/"(.+?\.js)"/g, (_, $1) => {
        scriptsObj[$1] = readFileSync($1).toString()
    })

    let { code } = await terserMinify(scriptsObj, {
        compress: {
            global_defs: {
                'self.env': 'production'
            }
        },
        mangle: true,
        toplevel: true,
        format: {
            ascii_only: true,
            safari10: true,
        }
    })

    return `${htmlBody}
<script>${code}</script>`
}


async function buildZip() {
    const html = await getHtml({ minify: true })

    mkdirSync('/tmp/js13k/.build', { recursive: true })
    writeFileSync('/tmp/js13k/.build/index.html', html)

    console.log(execSync(`zip -9 build.zip /tmp/js13k/.build/index.html`).toString())
    console.log(execSync(`ls -al build.zip`).toString())
    console.log(execSync(`ls -alh build.zip`).toString())

    execSync(`mv build.zip /tmp/js13k/.build/`)
}

switch (process.argv[2]) {
    case 'build': {
        await buildZip()
        break
    }
    case 'serve': {
        const app = express()
        app.use(compression())
        app.on('error', err=>{console.error(err)})
        app.get('/', (req, res) => {
            getHtml({minify: process.argv.includes('--compressed')}).then(
                html => res.contentType('html').end(html),
                err => res.end(err.stack)
            )
        })
        app.use('/', express.static('.'))
        app.listen(3000, (err) => {
            if (err) throw (err)
            else console.log('listening on http://localhost:3000')
        })
        break
    }
    default: {
        console.error(`usage:\nnode ./build.js build (requires 'zip' command)\nnode ./build.js serve`)
        process.exit(1)
    }
}