'use strict';

var pathUtil = require('path');
var Q = require('q');
var gulp = require('gulp');
var less = require('gulp-less');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var plumber = require('gulp-plumber');
var jetpack = require('fs-jetpack');

// var bundle = require('./bundle'); // Bundle causes pain, because angular actually needs global variables.
var generateSpecImportsFile = require('./generate_spec_imports');
var utils = require('../utils');

var projectDir = jetpack;
var srcDir = projectDir.cwd('./app');
var destDir = projectDir.cwd('./build');

var paths = {
    copyFromAppDir: [
        './helpers/**',
        './**/*+(html|js|css)',
        './**/*.+(jpg|png|svg)',
        './ant/**',
        './main/**'
    ],
    copyFromModules: [
        './node_modules/**'
    ]
};

// Specify the path where ant native dlls / libraries live.
var antNativePath = 'app/ant_native'; 

// -------------------------------------
// Tasks
// -------------------------------------

gulp.task('clean', function () {
    return destDir.dirAsync('.', { empty: true });
});


var copyTask = function () {
        projectDir.copy('app', destDir.path(), {
            overwrite: true,
            matching: paths.copyFromAppDir
        });

        //
        // Swallow any errors trying to copy native binaries since they will be 'in use' and
        // will prevent the 'watch' tasks from working that enable rapid development with the
        // non-binary components of the app.
        //  
        try {
            projectDir.copy('app', destDir.path(), {
                overwrite: true,
                matching: paths.copyFromModules
            });
                        
            // Copy all ant native libraries to the root of the build folder.
            projectDir.copy(antNativePath, destDir.path(), {
                overwrite: true,
                matching: ['*.*']
            });
        }
        catch (err) {
            console.log('Unable to copy native libraries.', err);
        } 
};
gulp.task('copy', ['clean'], copyTask);
gulp.task('copy-watch', copyTask);

/*
var bundleApplication = function () {
    return Q.all([
            bundle(srcDir.path('background.js'), destDir.path('background.js')),
            bundle(srcDir.path('app.js'), destDir.path('app.js')),
        ]);
};

var bundleSpecs = function () {
    return generateSpecImportsFile().then(function (specEntryPointPath) {
        return bundle(specEntryPointPath, destDir.path('spec.js'));
    });
};

var bundleTask = function () {
    if (utils.getEnvName() === 'test') {
        return bundleSpecs();
    }
    return bundleApplication();
};
gulp.task('bundle', ['clean'], bundleTask);
gulp.task('bundle-watch', bundleTask);
*/

var lessTask = function () {
    return gulp.src('app/stylesheets/main.less')
        .pipe(plumber())
        .pipe(less())
        .pipe(gulp.dest(destDir.path('stylesheets')));
};
gulp.task('less', ['clean'], lessTask);
gulp.task('less-watch', lessTask);


gulp.task('finalize', ['clean'], function () {
    var manifest = srcDir.read('package.json', 'json');

    // Add "dev" or "test" suffix to name, so Electron will write all data
    // like cookies and localStorage in separate places for each environment.
    switch (utils.getEnvName()) {
        case 'development':
            manifest.name += '-dev';
            manifest.productName += ' Dev';
            break;
        case 'test':
            manifest.name += '-test';
            manifest.productName += ' Test';
            break;
    }

    // Copy environment variables to package.json file for easy use
    // in the running application. This is not official way of doing
    // things, but also isn't prohibited ;)
    manifest.env = projectDir.read('config/env_' + utils.getEnvName() + '.json', 'json');

    destDir.write('package.json', manifest);
});


gulp.task('watch', function () {
    watch('app/**/*.js', batch(function (events, done) {
        gulp.start('bundle-watch', done);
    }));
    watch(paths.copyFromAppDir, { cwd: 'app' }, batch(function (events, done) {
        gulp.start('copy-watch', done);
    }));
    watch('app/**/*.less', batch(function (events, done) {
        gulp.start('less-watch', done);
    }));
});

gulp.task('build', [/*'bundle',*/ 'less', 'copy', 'finalize']);
