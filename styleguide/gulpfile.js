var gulp        = require('gulp'),
    bump        = require('gulp-bump'),
    clean       = require('gulp-clean'),
    concat      = require('gulp-concat'),
    browserSync = require('browser-sync'),
    cssmin      = require('gulp-cssmin'),
    filter      = require('gulp-filter'),
    git         = require('gulp-git'),
    gulpif      = require('gulp-if'),
    imagemin    = require('gulp-imagemin'),
    rename      = require('gulp-rename'),
    sass        = require('gulp-sass'),
    shell       = require('gulp-shell'),
    tagversion  = require('gulp-tag-version'),
    uglify      = require('gulp-uglify'),
    config      = require('./build.config.json');
    ghPages     = require('gulp-gh-pages'),
    runSequence = require('run-sequence'),
    glob        = require('glob'),
    svgmin      = require('gulp-svgmin'),
    gulpicon    = require('gulpicon/tasks/gulpicon');



// Trigger
var production;

// Task: Clean:before
// Description: Removing assets files before running other tasks
gulp.task('clean:before', function () {
  return gulp.src(
    config.assets.dest
  )
    .pipe(clean({
      force: true
    }))
});

// Task: Handle scripts
gulp.task('scripts', function () {
  return gulp.src(config.scripts.files)
    .pipe(concat(
      'application.js'
    ))
    .pipe(gulpif(production, uglify()))
    .pipe(gulpif(production, rename({
      suffix: '.min'
    })))
    .pipe(gulp.dest(
      config.scripts.dest
    ))
    .pipe(browserSync.reload({stream:true}));
});

// Task: Handle fonts
gulp.task('fonts', function () {
  return gulp.src(config.fonts.files)
    .pipe(gulp.dest(
      config.fonts.dest
    ))
    .pipe(browserSync.reload({stream:true}));
});

// Task: Handle images
gulp.task('images', function () {
  return gulp.src(config.images.files)
    .pipe(gulpif(production, imagemin()))
    .pipe(gulp.dest(
      config.images.dest
    ))
    .pipe(browserSync.reload({stream:true}));
});

// Task: Handle Sass and CSS
gulp.task('sass', function () {
  return gulp.src(config.scss.files)
    .pipe(sass())
    .pipe(gulpif(production, cssmin()))
    .pipe(gulpif(production, rename({
      suffix: '.min'
    })))
    .pipe(gulp.dest(
      config.scss.dest
    ))
    .pipe(browserSync.reload({stream:true}));
});

// Task: Handle icons
// We have to do this in a few steps until
// https://github.com/filamentgroup/gulpicon/issues/1 is resolved
gulp.task('minifyIcons', function() {
  return gulp.src(config.icons.files)
      .pipe(svgmin())
      .pipe(gulp.dest(config.icons.min));
});

// Based on https://github.com/filamentgroup/gulpicon#usage
var iconFiles = glob.sync("source/assets/icons/svg/*.svg");
var iconConfig = require("./source/assets/icons/config.js");
iconConfig.dest = "public/assets/icons/";
gulp.task('makeIcons', gulpicon(iconFiles, iconConfig));
gulp.task('reloadIcons', function() {
  return gulp.src('', {read: false})
    .pipe(browserSync.reload({stream:true}));
});

gulp.task('icons', function (callback) {
  runSequence('minifyIcons', 'makeIcons', 'reloadIcons');
  callback();
});

// Task: patternlab
// Description: Build static Pattern Lab files via PHP script
gulp.task('patternlab', function () {
  return gulp.src('', {read: false})
    .pipe(shell([
      'php core/console --generate'
    ]))
    .pipe(browserSync.reload({stream:true}));
});

// Task: styleguide
// Description: Copy Styleguide-Folder from core/ to public
gulp.task('styleguide', function() {
  return gulp.src(config.patternlab.styleguide.files)
    .pipe(gulp.dest(config.patternlab.styleguide.dest));
});

// task: BrowserSync
// Description: Run BrowserSync server with disabled ghost mode
gulp.task('browser-sync', function() {
  browserSync({
    server: {
        baseDir: config.root
    },
    ghostMode: true,
    open: "local"
  });
});

// Task: Watch files
gulp.task('watch', function () {

  // Watch Pattern Lab files
  gulp.watch(
    config.patternlab.files,
    ['patternlab']
  );

  // Watch scripts
  gulp.watch(
    config.scripts.files,
    ['scripts']
  );

  // Watch images
  gulp.watch(
    config.images.files,
    ['images']
  );

  // Watch Sass
  gulp.watch(
    config.scss.files,
    ['sass']
  );

  // Watch icons
  gulp.watch(
    config.icons.files,
    ['icons']
  );

  // Watch fonts
  gulp.watch(
    config.fonts.files,
    ['fonts']
  );
});

// Task: Default
// Description: Build all stuff of the project once
gulp.task('default', ['clean:before'], function (callback) {
  production = false;

  // We need to re-run sass last to make sure the latest styles.css gets loaded
  runSequence(
    'icons',
    ['scripts', 'fonts', 'images', 'sass'],
    'patternlab',
    'styleguide',
    'sass',
    callback
  );
});

// Task: Start your production-process
// Description: Typ 'gulp' in the terminal
gulp.task('serve', function () {
  production = false;

  gulp.start(
    'browser-sync',
    'default',
    'watch'
  );
});

// Task: Deploy static content
// Description: Deploy static content using rsync shell command
gulp.task('deploy', function () {
  return gulp.src(config.deployment.local.path)
    .pipe(ghPages());
});

// Function: Releasing (Bump & Tagging)
// Description: Bump npm versions, create Git tag and push to origin
gulp.task('release', function () {
  production = true;

  return gulp.src(config.versioning.files)
    .pipe(bump({
      type: gulp.env.type || 'patch'
    }))
    .pipe(gulp.dest('./'))
    .pipe(git.commit('Release a ' + gulp.env.type + '-update'))

    // read only one file to get version number
    .pipe(filter('package.json'))

    // Tag it
    .pipe(tagversion())

    // Publish files and tags to endpoint
    .pipe(shell([
      'git push origin develop',
      'git push origin --tags'
    ]));
});
