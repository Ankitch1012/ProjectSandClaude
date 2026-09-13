function frontStatus(_record, courses) {
  const count = courses.filter((course) => course.frontSupport).length;
  return {
    complete: count >= 2,
    observed: count,
    required: 2,
  };
}

module.exports = { frontStatus };
