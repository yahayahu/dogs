const {watch, series, parallel, src, dest, task} = require('gulp');
const del                                        = require('del');
const plumber                                    = require('gulp-plumber');
const cache                                      = require('gulp-cache');
const zip                                        = require('gulp-zip');
const mergeStream                                = require('merge-stream');
const fs                                         = require('fs');

const sass         = require('gulp-sass');
sass.compiler      = require('node-sass');
const sourcemaps   = require('gulp-sourcemaps');
const cssnano      = require('cssnano');
const autoprefixer = require('autoprefixer');
const postcss      = require('gulp-postcss');
const flexFix      = require('postcss-flexbugs-fixes');

const imagemin    = require('gulp-imagemin');
const realFavicon = require('gulp-real-favicon');
const htmlmin     = require('gulp-htmlmin');
const browserSync = require('browser-sync').create();
const uglify      = require('gulp-uglify-es').default;

const iconfont    = require('gulp-iconfont');
const iconfontCss = require('gulp-iconfont-css');
const woff        = require('gulp-ttf2woff');
const woff2       = require('gulp-ttf2woff2');

const projectConfig     = require('./package.json');
const FAVICON_DATA_FILE = 'faviconData.json';


function removeDist() {
    return del('dist');
}

function removeZip() {
    return del(`${projectConfig.name}.zip`, {force: true});
}

function compileSass() {
    return src(['src/sass/*.scss', 'src/sass/libs/*.scss']).
        pipe(plumber()).
        pipe(sourcemaps.init()).
        pipe(sass({outputStyle: 'expanded'}).on('error', sass.logError)).
        pipe(sourcemaps.write('./')).
        pipe(dest('src/css')).
        pipe(browserSync.stream());
}

function buildCSS() {
    return src('src/css/*.css').
        pipe(postcss([
            autoprefixer({cascade: false}),
            flexFix(),
            cssnano()
        ])).
        pipe(dest('dist/css'));
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
    ).pipe(dest('dist/images'));
}

function favicon(done) {
    return realFavicon.generateFavicon({
        masterPicture: 'src/assets/favicon.png',
        dest:          'dist/favicon',
        iconsPath:     'favicon/',
        design:        {
            ios:            {
                pictureAspect: 'noChange',
                assets:        {
                    ios6AndPriorIcons:      false,
                    ios7AndLaterIcons:      false,
                    precomposedIcons:       false,
                    declareOnlyDefaultIcon: true
                }
            },
            desktopBrowser: {},
            windows:        {
                pictureAspect:   'noChange',
                backgroundColor: '#da532c',
                onConflict:      'override',
                assets:          {
                    windows80Ie10Tile:      false,
                    windows10Ie11EdgeTiles: {
                        small:     false,
                        medium:    true,
                        big:       false,
                        rectangle: false
                    }
                }
            },
            androidChrome:  {
                pictureAspect: 'noChange',
                themeColor:    '#ffffff',
                manifest:      {
                    display:     'standalone',
                    orientation: 'notSet',
                    onConflict:  'override',
                    declared:    true
                },
                assets:        {
                    legacyIcon:         false,
                    lowResolutionIcons: false
                }
            }
        },
        settings:      {
            scalingAlgorithm:     'Mitchell',
            errorOnImageTooSmall: false,
            readmeFile:           false,
            htmlCodeFile:         false,
            usePathAsIs:          false
        },
        markupFile:    FAVICON_DATA_FILE
    }, function () {
        src('dist/*.html').
            pipe(realFavicon.injectFaviconMarkups(
                JSON.parse(fs.readFileSync(FAVICON_DATA_FILE)).favicon.html_code)
            ).
            pipe(dest('dist')).on('end', done);
    });
}

function checkFaviconUpdate(done) {
    const currentVersion = JSON.parse(fs.readFileSync(FAVICON_DATA_FILE)).version;

    realFavicon.checkForUpdates(currentVersion, function (err) {
        if (err) {
            throw err;
        }
        done();
    });
}

function buildHtml() {
    return src('src/*.html').pipe(htmlmin({collapseWhitespace: true})).pipe(dest('dist'));
}

function clear() {
    return cache.clearAll();
}

function buildJS() {
    const moveMinifyJS = src(['src/js/common.js']).
        pipe(dest('dist/js'));

    const minAndMoveJS = src(['src/js/*', '!src/js/*.min.{js, js.map}', '!src/js/common.js']).
        pipe(uglify()).
        pipe(dest('dist/js'));

    return mergeStream(moveMinifyJS, minAndMoveJS);
}

function buildFonts() {
    return src('src/fonts/**/*').
        pipe(dest('dist/fonts'));
}

function getZip() {
    return src(['**/*', '!node_modules/**', '!..*']).
        pipe(zip(`${projectConfig.name}.zip`)).
        pipe(dest('./'));
}

function fontIcon() {
    return src('src/assets/icons/*.svg').pipe(iconfontCss({
        fontName:   'iconfont',
        path:       'src/assets/templates/iconfont',
        targetPath: '../../css/iconfont.css',
        fontPath:   '../fonts/iconfont/'
    })).pipe(iconfont({
        fontName:           'iconfont',
        prependUnicode:     true,
        formats:            ['woff', 'woff2'],
        timestamp:          Math.round(Date.now() / 1000),
        centerHorizontally: true,
        normalize:          true
    })).pipe(dest('src/fonts/iconfont'));
}

function fonts() {
    const woffFonts = src('src/assets/fonts/**/*.ttf').
        pipe(woff()).
        pipe(dest('src/fonts'));

    const woff2Fonts = src('src/assets/fonts/**/*.ttf').
        pipe(woff2()).
        pipe(dest('src/fonts'));

    return mergeStream(woffFonts, woff2Fonts);
}

exports.default = function () {
    browserSync.init({
        server: {
            baseDir: 'src',
            index:   'index.html'
        },
        open:   false,
        notify: false
    });

    watch('src/assets/icons/*.svg', fontIcon);
    watch('src/sass/**/*.{scss, sass}', compileSass);
    watch('src/*.html').on('change', browserSync.reload);
};

exports.build = series(removeDist,
    parallel(series(compileSass, buildCSS), buildImages, buildHtml, buildJS, buildFonts)
);

exports.zip = series(removeZip, getZip);

task(removeDist);
task(clear);
task(fontIcon);
task(fonts);
task(favicon);
task(checkFaviconUpdate);
