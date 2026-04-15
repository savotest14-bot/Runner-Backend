module.exports = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: true });

    if (error) {
      const message = error.details[0].message;
      return res.status(400).send({ message });
    }

    next();
  };
};

