var gulp = require('gulp');
var ts = require('gulp-typescript');
var del = require('del');


// Clean tasks

gulp.task('clean', function() {
    return del('dist')
});


// Build tasks

gulp.task('copy', function() {
    return gulp.src('data/**/*.*')
        .pipe(gulp.dest('dist/data'));
});

gulp.task('ts', function() {
    return gulp.src('src/**/*.ts')
        .pipe(ts({
            target: 'ES2015',
            module: 'CommonJS',
            declaration: true,
            noImplicitAny: true,
         }))
        .pipe(gulp.dest('dist'));
});

gulp.task('js', function() {
    return gulp.src('src/**/*.js').pipe(gulp.dest('dist'));
})

gulp.task('build', gulp.series('copy', 'js', 'ts'));
gulp.task('default', gulp.series('build'));
