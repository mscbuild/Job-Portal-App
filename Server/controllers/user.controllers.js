import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

export const register = async (req, res) => {
    try {

        const { fullname, email, phoneNumber, password, role } = req.body;

        if (!fullname || !email || !phoneNumber || !password || !role) {
            return res.status(400).json({
                message: "Someting is missing",
                success: false,
            });
        }
        const file = req.file
        let cloudResponse = ""
        if (file) {
            const fileUri = getDataUri(file)
            cloudResponse = await cloudinary.uploader.upload(fileUri.content)
        }

        const existedUser = await User.findOne({ email: email });
        if (existedUser) {
            return res.status(400).json({
                message: "User already exists",
                success: false,
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let url = null;
        if (file && cloudResponse) {
            url = cloudResponse.secure_url;
        }

        await User.create({
            fullname, email, phoneNumber,
            password: hashedPassword,
            role,
            profile: {
                profilePhoto: url,
            }
        })

        return res.status(201).json({
            message: 'Account created',
            success: true,
        })

    } catch (error) {
        console.log(error)
    }
}


export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Email or password is missing",
                success: false
            })
        }

        let user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({
                message: "User not found",
                success: false
            })
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        // check role is correct or not and also verify password
        if (!isPasswordMatch || role != user.role) {
            return res.status(400).json({
                message: "Incorrect Credentials",
                success: false
            })
        }

        const tokenData = {
            userId: user._id,
        }

        const token = await jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: "1d" });

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile,
        }

        return res.status(200).cookie("token", token,
            {
                maxAge: 1 * 24 * 60 * 60 * 1000, 
                httpOnly: true,
                sameSite: 'none',
                secure: true
            },
        ).json({
            message: `Welcome back ${user.fullname}`,
            user,
            success: true,
        })


    } catch (error) {
        console.log(error);
    }
}


export const logout = async (req, res) => {
    try {

        return res.status(200).cookie("token", "", { maxAge: 0 })
            .json({
                message: "Logged out successfully",
                success: true,
            })

    } catch (error) {
        console.log(error);
    }
}


export const updateProfile = async (req, res) => {
    try {

        const { fullname, email, phoneNumber, bio, skills } = req.body;
        const file = req.file

        let cloudResponse = "";

        // file upload
        if (file) {
            const fileUri = getDataUri(file);
            cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                resource_type: 'auto',
            });
        }


        let skillsArray
        if (skills) {
            skillsArray = skills.split(",");
        }

        const userId = req.id;
        let user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found",
                success: false,
            })
        }


        if (fullname) user.fullname = fullname
        if (email) user.email = email
        if (phoneNumber) user.phoneNumber = phoneNumber
        if (bio) user.profile.bio = bio
        if (skills) user.profile.skills = skillsArray;

        // resume upload
        if (file && cloudResponse) {
            user.profile.resume = cloudResponse.secure_url;
            user.profile.resumeOriginalName = file.originalname;
        }

        await user.save();


        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile,
        }

        return res.status(200).json({
            message: "Profile updated",
            user,
            success: true,
        })



    } catch (error) {
        console.log(error);
    }
}
