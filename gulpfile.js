var gulp = require('gulp');
var ts = require('gulp-typescript');
var del = require('del');


// Clean tasks

gulp.task('clean', function() {
    return del('dist')
});


// Build tasks

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

gulp.task('build', gulp.series('js', 'ts'));
gulp.task('default', gulp.series('build'));
