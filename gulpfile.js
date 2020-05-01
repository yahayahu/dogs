const {watch, series, parallel, src, dest, task} = require('gulp')
const del                                        = require('del')
const plumber                                    = require('gulp-plumber')
const cache                                      = require('gulp-cache')
const zip                                        = require('gulp-zip')

const sass         = require('gulp-sass')
sass.compiler      = require('node-sass')
const sourcemaps   = require('gulp-sourcemaps')
const cleanCSS     = require('gulp-clean-css')
const autoprefixer = require('gulp-autoprefixer')

const imagemin    = require('gulp-imagemin')
const htmlmin     = require('gulp-htmlmin')
const browserSync = require('browser-sync').create()

const projectConfig = require('./package.json')

function removeDist() {
    return del('dist')
}

function removeZip() {
    return del(`${projectConfig.name}.zip`, {force: true})
}

function compileSass() {
    return src('src/sass/*.scss').
        pipe(plumber()).
        pipe(sourcemaps.init()).
        pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError)).
        pipe(sourcemaps.write('./')).
        pipe(dest('src/css')).
        pipe(browserSync.stream())
}

function buildCSS() {
    return src('src/css/*.css').
        pipe(autoprefixer({cascade: false})).
        pipe(cleanCSS({compatibility: 'ie10'})).
        pipe(dest('dist/css'))
}

function buildImages() {
    return src('src/images/**/*').pipe(cache(
        imagemin([
            imagemin.gifsicle({interlaced: true}),
            imagemin.mozjpeg({quality: 75, progressive: true}),
            imagemin.optipng({optimizationLevel: 5}),
            imagemin.svgo({
                plugins: [
                    {removeViewBox: true},
                    {cleanupIDs: false}
                ]
            })
        ], {
            verbose: true
        }), {
            name: 'images'
        })
    ).pipe(dest('dist/images'))
}

function buildHtml() {
    return src('src/*.html').pipe(htmlmin({collapseWhitespace: true})).pipe(dest('dist'))
}

function clearCache() {
    return cache.clearAll()
}

function buildJS() {
    return src('src/js').
        pipe(dest('dist/js'))
}

function getZip() {
    return src(['**/*', '!node_modules/**', '!..*']).
        pipe(zip(`${projectConfig.name}.zip`)).
        pipe(dest('./'))
}

exports.default = function () {
    browserSync.init({
        server: {
            baseDir: 'src',
            index:   'index.html'
        },
        open:   false,
        notify: false
    })

    watch('src/sass/**/*.scss', compileSass)
    watch('src/*.html').on('change', browserSync.reload)
}

exports.build = series(removeDist,
    parallel(series(compileSass, buildCSS), buildImages, buildHtml, buildJS)
)

exports.zip = series(removeZip, getZip)

task(removeDist)
task(clearCache)
