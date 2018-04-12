const del = require('del');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglifyes');
const posthtml = require('gulp-posthtml')
const postcss = require('posthtml-postcss')
const htmlnano = require('gulp-htmlnano');
const mergeStream = require('merge-stream');
const polymerBuild = require('polymer-build');
const gulpCopy = require('gulp-copy');
const polymerJson = require('./polymer.json');

const polymerProject = new polymerBuild.PolymerProject(polymerJson);
const buildDirectory = 'build';

function waitFor(stream) {
    return new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
    });
}

function build() {
    return new Promise((resolve, reject) => {

        let sourcesStreamSplitter = new polymerBuild.HtmlSplitter();
        let dependenciesStreamSplitter = new polymerBuild.HtmlSplitter();

        console.log(`Deleting ${buildDirectory} directory...`);
        del([`${buildDirectory}/**`])
            .then(() => {
                let sourcesStream = polymerProject.sources()
                    .pipe(sourcesStreamSplitter.split())
                    .pipe(gulpif(/\.js$/, uglify()))
                    .pipe(gulpif(/\.html$/,
                        posthtml([
                            postcss([
                                require('autoprefixer')(),
                                require('cssnano')(),
                            ], {from: '.'})
                        ])
                    ))
                    .pipe(gulpif(/\.html$/, htmlnano()))
                    .pipe(sourcesStreamSplitter.rejoin());

                let dependenciesStream = polymerProject.dependencies()
                    .pipe(dependenciesStreamSplitter.split())
                    .pipe(gulpif(/\.js$/, uglify()))
                    .pipe(dependenciesStreamSplitter.rejoin());

                let buildStream = mergeStream(sourcesStream, dependenciesStream)
                    .pipe(polymerProject.bundler({
                        sourcemaps: true,
                        stripComments: true
                    }))
                    .pipe(gulp.dest(buildDirectory));
                return waitFor(buildStream);
            })
            .then(() => {
                console.log('Build complete!');
                resolve();
            });
    });
}

function copy() {
    const sourceFiles = ['src/**', 'bower_components/**'];
    gulp.src(sourceFiles)
        .pipe(gulpCopy(buildDirectory))
}

gulp.task('build', build);
gulp.task('copy', ['build'], copy);
gulp.task('default', ['build', 'copy']);