const models = require('../models/index');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const config = require('../config/config');
const crypto = require('crypto');
const moment = require('moment');

let sessionUserId;

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const _user = await models.User.findOne({ where: { email } });
    if (_user) {
      const technician = await models.Technician.findOne({
        where: { user_id: _user.id },
      });
      if (technician) {
        if (technician.approved === false) {
          return res.status(401).json({
            message:
              'Login as a Technician Failed because You are not Approved by the Admin. Contact our Support for further guidance.',
          });
        }
      }
      const isMatch = await bcrypt.compare(password, _user.password);
      if (isMatch) {
        const userDetails = {
          userName: _user.name,
          userId: _user.id,
          userType: _user.type,
        };
        req.session.userDetails = userDetails;
        res.status(200).json({
          status: 'success',
          message: `Login Successful! Welcome ${_user.name}!`,
          userDetails: req.session.userDetails,
        });
        console.log(`Success! ${_user.name}`);
      } else {
        res.status(500).json({
          status: 'Failed',
          message: 'Incorrect Password.',
        });
        console.log('Fail! Incorrect Password.');
      }
    } else {
      res.status(404).json({
        status: 'Fail',
        message: 'No User found with Email ',
        email,
      });
      console.log('Fail!, Invalid Credentials');
    }
  } catch (err) {
    res.status(500).json({
      message: 'Error while trying to LOgin. Try Again Later.',
      error: 'Server error.',
    });
    console.log(err);
  }
};

exports.getUser = async (req, res) => {
  try {
    console.log(req.session.userDetails.userId);
    const _user = await models.User.findOne({
      where: {
        id: req.session.userDetails.userId,
      },
    });
    res.status(200).json({
      _user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: `Oops, Something went wrong. Session Expired. Redirecting to Login`,
    });
  }
};

exports.resetPasswordEmail = async (req, res) => {
  try {
    const _user = await models.User.findOne({
      where: { email: req.body.email },
    });
    if (!_user) {
      throw new Error('user doesnt exist');
    }

    sessionUserId = _user.id;
    console.log(req.session.userId);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'apna.garage.2024@gmail.com',
        pass: config.database.appPassword,
      },
    });

    const resetLink =
      'http://127.0.0.1:5500/Apna-Garage/frontend/pages/resetPassword.html';
    // Email options
    const mailOptions = {
      from: 'Apna Garage Team <apna.garage.2024@gmail.com>',
      to: req.body.email,
      subject: 'Reset Your Password',
      text: `Click the link to reset your password: ${resetLink}`, // Plain text email
      html: `<p>Click the link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`, // HTML version
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully!');
    return res.status(200).json({ data: 'temp1' });
  } catch (error) {
    res.status(400).json({
      message: 'Oops, Something went wrong. Try Again Later.',
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    // Extract data from the request body
    const { newPassword } = req.body;
    console.log(sessionUserId);

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the password in the database
    const [rowsUpdated] = await models.User.update(
      { password: hashedPassword },
      { where: { id: sessionUserId } }
    );

    // Handle cases where no rows were updated
    if (rowsUpdated === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or no changes were made.',
      });
    }

    // Respond with success
    sessionUserId = undefined;
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Error updating password:', error);

    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      message:
        'An error occurred while updating the password. Please try again later.',
    });
  }
};

exports.sendVerificationCode = async (req, res) => {
  try {
    console.log(req.body.email);
    const presence = await models.User.findOne({
      where: { email: req.body.email },
    });
    if (presence) {
      return res.status(500).json({
        message:
          'An Account with this Email Already Exists. Use a Different Email to Sign Up.',
      });
    }
    const verCode = crypto.randomBytes(4).toString('hex');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'apna.garage.2024@gmail.com',
        pass: config.database.appPassword,
      },
    });

    // Email options
    const mailOptions = {
      from: 'Apna Garage Team <apna.garage.2024@gmail.com>',
      to: req.body.email,
      subject: 'Sign Up Verification Code.',
      text: `Type the following code in the dialogue box to Verify Your Email: ${verCode}`, // HTML version
    };

    // Send email
    await transporter.sendMail(mailOptions);
    res.status(200).json({
      message: `Email Verification Code sent at ${req.body.email}`,
      verCode,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      message: `Error while trying to send Verification Code. ${error.message}`,
    });
  }
};

//function to delete a customer:
exports.deleteCustomer = async (req, res) => {
  try {
    const deleted = await models.User.destroy({
      where: { id: req.session.userDetails.userId },
    });

    if (!deleted) {
      return res.status(404).json({
        error: 'Customer not found.',
      });
    }
    res.status(204).json({
      status: 'successful',
      data: null, // No data to return
    });
  } catch (err) {
    res.status(500).json({
      error: 'Server error.',
    });
  }
};

exports.updateUser = async (req, res) => {
  // console.log("Printing body data : \n");
  // console.log(req.body);

  // body data correctly received, VERIFIED

  try {
    // Extract data from the request body
    const data = req.body;
    const user = req.session.userDetails.userId;
    // console.log(req.session.userDetails.userId);
    // console.log(data);

    // // data => name , email , address , contact, dob

    if (data.dob) {
      const formattedDOB = moment(req.body.dob, 'DD/MM/YYYY', true);
      if (!formattedDOB.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Please use DD/MM/YYYY.',
        });
      }
      data.dob = formattedDOB.format('YYYY-MM-DD'); // Convert to ISO format
    }

    // Update the user in the database
    const [rowsUpdated] = await models.User.update(
      {
        name: data.name,
        email: data.email,
        address: data.address,
        contact: data.contact,
        dob: data.dob,
      },
      { where: { id: user } }
    );
    req.session.userDetails.userName = data.name;
    // Handle cases where no rows were updated
    if (rowsUpdated === 0) {
      return res.status(404).json({
        success: false,
        message: 'No changes were made.',
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'User updated successfully.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        'An error occurred while updating the user. Please try again later.',
    });
  }
};
