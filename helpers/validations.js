const Joi = require('joi');

const  validateUser = (user) => {
    const schema = Joi.object({
        Username :Joi.string().min(3).max(255).required(),
        Password:Joi.string().min(6).max(255).required(),
    })
    return schema.validate(user);
}



module.exports.validateUser = validateUser;
