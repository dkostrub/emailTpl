'use strict';

import gulp      from 'gulp';
import plugins   from 'gulp-load-plugins';
import rimraf    from 'rimraf';
import yargs     from 'yargs';
import notify    from 'gulp-notify';
import plumber   from 'gulp-plumber';
import concat    from 'gulp-concat';
import rigger    from 'gulp-rigger';
import changed   from 'gulp-changed';
import browser   from 'browser-sync';
import fs        from 'fs';
import lazypipe  from 'lazypipe';
import siphon    from 'siphon-media-query';
import cache     from 'gulp-cache';

const $ = plugins();
const PRODUCTION = !!(yargs.argv.production);
const Func = {};

Func.showMessage = function (message) {
    function twoNumbers(num) {
        return ('0' + num).slice(-2);
    }
    const stamp = new Date();
    console.log('['+twoNumbers(stamp.getHours())+':'+twoNumbers(stamp.getMinutes())+':'+twoNumbers(stamp.getSeconds())+'] '+ message);
};

const path = {
    build: {
        html: 'build/',
        css: 'build/css/',
        img: 'build/img/'
    },
    src: {
        html: 'dev/*.html',
        tpl: 'dev/template/*.html',
        style: 'dev/style/*.scss',
        img: 'dev/img/**/*.*'
    },
    watch: {
        html: 'dev/**/*.html',
        style: 'dev/style/**/*.scss',
        img: 'dev/img/**/*.*'
    },
    clean: './build'
};

const errorHandler = {
    errorHandler: notify.onError({
        title: 'Ошибка в плагине <%= error.plugin %>',
        message: "\nОшибка: <%= error.message %>"
    })
};

gulp.task('build',
    gulp.series(clean, pages, sass, images, inline));

gulp.task('default',
    gulp.series('build', server, watch));

function clean(done) {
    rimraf(path.clean, done);
}

function pages() {
    return gulp.src(path.src.html)
        .pipe(plumber(errorHandler))
        .pipe(rigger())
        .pipe(gulp.dest(path.build.html));
}

function resetPages(done) {
    cache.clearAll();
    done();
    // return cache.clearAll(done);
}

function sass() {
    return gulp.src(path.src.style)
        .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
        .pipe(changed(path.build.css))
        .pipe($.sass().on('error', $.sass.logError))
        .pipe($.if(PRODUCTION, $.uncss(
            {
                html: ['build/**/*.html']
            })))
        .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
        .pipe(plumber(errorHandler))
        .pipe(gulp.dest(path.build.css)).on('end', function () {
            Func.showMessage('New build sass create!');
        });
}

function inline() {
    return gulp.src('build/**/*.html')
        .pipe($.if(PRODUCTION, inliner('build/css/styles.css')))
        .pipe(plumber(errorHandler))
        .pipe(gulp.dest(path.build.html)).on('end', function () {
            Func.showMessage('Inline css success!');
        });
}

function images() {
    return gulp.src(path.src.img)
        .pipe($.imagemin())
        .pipe(plumber(errorHandler))
        .pipe(gulp.dest(path.build.img));
}

function server(done) {
    browser.init({
        server: "build"
    });
    done();
}

function watch() {
    gulp.watch(path.src.html).on('all', gulp.series(pages, inline, browser.reload));
    gulp.watch(path.src.tpl).on('all', gulp.series(resetPages, pages, inline, browser.reload));
    gulp.watch(path.src.style).on('all', gulp.series(resetPages, sass, pages, inline, browser.reload));
    gulp.watch(path.src.img).on('all', gulp.series(images, browser.reload));
}

function inliner(css) {
    var css = fs.readFileSync(css).toString();
    var mqCss = siphon(css);

    var pipe = lazypipe()
        .pipe($.inlineCss, {
            applyStyleTags: false,
            removeStyleTags: true,
            preserveMediaQueries: true,
            removeLinkTags: false
        })
        .pipe($.replace, '<!-- <style> -->', `<style>${mqCss}</style>`)
        .pipe($.replace, '<link rel="stylesheet" type="text/css" href="css/styles.css">', '')
        .pipe($.htmlmin, {
            collapseWhitespace: true,
            minifyCSS: true
        });

    return pipe();
}