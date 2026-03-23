
const User = require("../models/user");
const Plan = require("../models/plan");
const Role = require("../models/role");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { generateRandomPassword } = require("../functions/password");
const { sendSimpleMail } = require("../functions/sendSimpleMail");
const { employeeWelcomeTemplate } = require("../emails/employeeWelcomeTemplate");
const { passwordUpdatedTemplate } = require("../emails/passwordUpdatedTemplate");
const Company = require("../models/company");




exports.createEmployee = async (req, res) => {
    try {
        if (!req.user?.company) {
            return res.status(403).json({
                message: "Only company admin can create employees",
            });
        }
        const company = await Company.findOne({
            _id: req.user.company,
            isDeleted: false
        })
        if (!company) {
            return res.status(404).json({
                message: "Company not found",
            });
        }

        const plan = await Plan.findById(company.planId);

        if (!plan) {
            return res.status(400).json({
                message: "Company plan not found",
            });
        }

        // ✅ Check employee limit using company counter
        if (company.currentEmployeeCount >= plan.employeeLimit) {
            return res.status(400).json({
                message: `Employee limit reached. Max allowed: ${plan.employeeLimit}`,
            });
        }

        const companyName = company.companyName

        const {
            firstName,
            lastName,
            email,
            phone,
            gender,
        } = req.body;

        if (!firstName || !email || !phone) {
            return res.status(400).json({
                message: "Missing firstName or email or phone or required fields",
            });
        }

        const existingEmail = await User.findOne({
            email: email.toLowerCase(),
            isDeleted: false,
        });

        if (existingEmail) {
            return res.status(409).json({
                message: "Employee already exists with this email",
            });
        }

        const existingPhoneNumber = await User.findOne({
            phone,
            isDeleted: false,
        });

        if (existingPhoneNumber) {
            return res.status(409).json({
                message: "Employee already exists with this phone number",
            });
        }

        const employeeRole = await Role.findOne({ name: "employee" });
        if (!employeeRole) {
            return res.status(500).json({
                message: "Employee role not found",
            });
        }

        const plainPassword = generateRandomPassword(10);


        const profileImageFile = req.files?.profileImage?.[0];
        const idImageFiles = req.files?.idImages || [];
        const aadhaarImageFiles = req.files?.aadhaarImages || [];

        let childrens = [];

        if (req.body.childrens) {
            try {
                childrens = JSON.parse(req.body.childrens);

                if (!Array.isArray(childrens)) {
                    return res.status(400).json({
                        message: "childrens must be an array",
                    });
                }
            } catch (err) {
                return res.status(400).json({
                    message: "Invalid childrens format",
                });
            }
        }


        const employeeProfile = {
            jobPosition: req.body.jobPosition,
            startDate: req.body.startDate,

            workHoursAndAvailability: req.body.workHoursAndAvailability,
            professionalQualifications: req.body.professionalQualifications,
            workExperience: req.body.workExperience,
            languageSkills: req.body.languageSkills,
            specialSkills: req.body.specialSkills,
            assignmentAreas: req.body.assignmentAreas,

            medicalInformation: req.body.medicalInformation,
            emergencyContacts: req.body.emergencyContacts,

            socialSecurityNumber: req.body.socialSecurityNumber,
            taxInformation: req.body.taxInformation,

            dateOfBirth: req.body.dateOfBirth,
            privateAddress: req.body.privateAddress,
            privatePhoneNumber: req.body.privatePhoneNumber,

            ahvNumber: req.body.ahvNumber,
            salaryAndWageDetails: req.body.salaryAndWageDetails,
            childrens,
            bankAccountInformation: req.body.bankAccountInformation || null,

            bonusAndBenefits: req.body.bonusAndBenefits,
            employmentContract: req.body.employmentContract,
            contractChanges: req.body.contractChanges,
            notice: req.body.notice,

            performanceEvaluations: req.body.performanceEvaluations,
            disciplinary: req.body.disciplinary,
            futureDevelopmentPlans: req.body.futureDevelopmentPlans,

            access: req.body.access,
            security: req.body.security,

            profileImage: profileImageFile
                ? {
                    fileName: profileImageFile.originalname,
                    fileUrl: `/uploads/profile-images/${profileImageFile.filename}`,
                }
                : null,

            documents: {
                idImages: idImageFiles.map((file) => ({
                    fileName: file.originalname,
                    fileUrl: `/uploads/id-images/${file.filename}`,
                })),
                aadhaarImages: aadhaarImageFiles.map((file) => ({
                    fileName: file.originalname,
                    fileUrl: `/uploads/aadhaar-images/${file.filename}`,
                })),
            },
        };

        const employee = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            gender,
            password: plainPassword,
            role: employeeRole._id,
            company: req.user.company,
            isApproved: "approved",
            employeeProfile,
        });

        try {
            const mail = employeeWelcomeTemplate({
                fullName: `${firstName} ${lastName}`,
                email,
                password: plainPassword,
                companyName,
            });

            await sendSimpleMail({
                to: email,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
            });
        } catch (mailError) {
            await User.findByIdAndDelete(employee._id);
            throw new Error("Employee created but email failed");
        }

        await Company.findByIdAndUpdate(
            company._id,
            { $inc: { currentEmployeeCount: 1 } }
        );

        return res.status(201).json({
            message: "Employee created successfully and email sent",
        });

    } catch (error) {
        console.error("Create employee error:", error);

        if (req.files) {
            const allFiles = [
                ...(req.files.profileImage || []),
                ...(req.files.idImages || []),
                ...(req.files.aadhaarImages || []),
            ];

            allFiles.forEach((file) => {
                fs.unlink(
                    path.join(file.destination, file.filename),
                    () => { }
                );
            });
        }

        return res.status(500).json({
            message: error.message || "Failed to create employee",
        });
    }
};


exports.getAllEmployees = async (req, res) => {
    try {


        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";

        const skip = (page - 1) * limit;

        const filter = {
            company: req.user.company,
            isDeleted: false,
            employeeProfile: { $ne: null },
            ...(search && {
                $or: [
                    { firstName: { $regex: search, $options: "i" } },
                    { lastName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                    {
                        "employeeProfile.jobPosition": {
                            $regex: search,
                            $options: "i",
                        },
                    },
                ],
            }),
        };

        const [employees, total] = await Promise.all([
            User.find(filter)
                .select(
                    "-password -employeeProfile.bankAccountInformation.accountNumber"
                )
                .populate("role", "name")
                .populate("company", "companyName")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            User.countDocuments(filter),
        ]);

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        const formattedEmployees = employees.map((emp) => {
            if (emp.employeeProfile?.profileImage?.fileUrl) {
                emp.employeeProfile.profileImage.fileUrl =
                    baseUrl + emp.employeeProfile.profileImage.fileUrl;
            }

            if (emp.employeeProfile?.documents?.idImages?.length) {
                emp.employeeProfile.documents.idImages =
                    emp.employeeProfile.documents.idImages.map((doc) => ({
                        ...doc,
                        fileUrl: baseUrl + doc.fileUrl,
                    }));
            }

            if (emp.employeeProfile?.documents?.aadhaarImages?.length) {
                emp.employeeProfile.documents.aadhaarImages =
                    emp.employeeProfile.documents.aadhaarImages.map((doc) => ({
                        ...doc,
                        fileUrl: baseUrl + doc.fileUrl,
                    }));
            }

            return emp;
        });

        return res.status(200).json({
            message: "Employees fetched successfully",
            data: formattedEmployees,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get employees error:", error);
        return res.status(500).json({
            message: "Failed to fetch employees",
        });
    }
};


exports.getEmployeeById = async (req, res) => {
    try {
        const { employeeId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({
                message: "Invalid employee id",
            });
        }

        const employee = await User.findOne({
            _id: employeeId,
            company: req.user.company,
            isDeleted: false,
            employeeProfile: { $ne: null },
        })
            .select(
                "-password"
            )
            .populate("role", "name")
            .populate("company", "companyName")
            .lean();

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found",
            });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;

        if (employee.employeeProfile?.profileImage?.fileUrl) {
            employee.employeeProfile.profileImage.fileUrl =
                baseUrl + employee.employeeProfile.profileImage.fileUrl;
        }

        if (employee.employeeProfile?.documents?.idImages?.length) {
            employee.employeeProfile.documents.idImages =
                employee.employeeProfile.documents.idImages.map((doc) => ({
                    ...doc,
                    fileUrl: baseUrl + doc.fileUrl,
                }));
        }

        if (employee.employeeProfile?.documents?.aadhaarImages?.length) {
            employee.employeeProfile.documents.aadhaarImages =
                employee.employeeProfile.documents.aadhaarImages.map((doc) => ({
                    ...doc,
                    fileUrl: baseUrl + doc.fileUrl,
                }));
        }

        return res.status(200).json({
            message: "Employee fetched successfully",
            data: employee,
        });
    } catch (error) {
        console.error("Get employee by id error:", error);
        return res.status(500).json({
            message: "Failed to fetch employee",
        });
    }
};



exports.updateEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        console.log("employee", req.files);
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({ message: "Invalid employee id" });
        }

        const employee = await User.findOne({
            _id: employeeId,
            company: req.user.company,
            isDeleted: false,
            employeeProfile: { $ne: null },
        });

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }
        const company = await Company.findOne({
            _id: req.user.company,
            isDeleted: false
        })

        const companyName = company.companyName
        let passwordChanged = false;
        let newPlainPassword = null;

        if (req.body.password) {
            newPlainPassword = req.body.password;
            employee.password = newPlainPassword;
            passwordChanged = true;
        }

        if (req.body.email && req.body.email !== employee.email) {
            const emailExists = await User.findOne({
                email: req.body.email.toLowerCase(),
                _id: { $ne: employeeId },
                isDeleted: false,
            });
            if (emailExists) {
                return res
                    .status(409)
                    .json({ message: "Email already in use" });
            }
            employee.email = req.body.email.toLowerCase();
        }

        if (req.body.phone && req.body.phone !== employee.phone) {
            const phoneExists = await User.findOne({
                phone: req.body.phone,
                _id: { $ne: employeeId },
                isDeleted: false,
            });
            if (phoneExists) {
                return res
                    .status(409)
                    .json({ message: "Phone number already in use" });
            }
            employee.phone = req.body.phone;
        }

        ["firstName", "lastName", "gender"].forEach((field) => {
            if (req.body[field] !== undefined) {
                employee[field] = req.body[field];
            }
        });

        let childrens;

        if (req.body.childrens !== undefined) {
            try {
                childrens = JSON.parse(req.body.childrens);

                if (!Array.isArray(childrens)) {
                    return res.status(400).json({
                        message: "childrens must be an array",
                    });
                }
                childrens.forEach((child, index) => {
                    if (!child.name || !child.gender || !child.dateOfBirth) {
                        throw new Error(`Invalid children data at index ${index}`);
                    }
                });
            } catch (err) {
                return res.status(400).json({
                    message: "Invalid childrens format",
                });
            }
        }

        const profileFields = [
            "jobPosition",
            "startDate",
            "workHoursAndAvailability",
            "professionalQualifications",
            "workExperience",
            "languageSkills",
            "specialSkills",
            "assignmentAreas",
            "medicalInformation",
            "emergencyContacts",
            "socialSecurityNumber",
            "taxInformation",
            "dateOfBirth",
            "privateAddress",
            "privatePhoneNumber",
            "ahvNumber",
            "salaryAndWageDetails",
            "bonusAndBenefits",
            "employmentContract",
            "contractChanges",
            "notice",
            "performanceEvaluations",
            "disciplinary",
            "futureDevelopmentPlans",
            "access",
            "security",
        ];

        profileFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                employee.employeeProfile[field] = req.body[field];
            }
        });
        if (childrens !== undefined) {
            employee.employeeProfile.childrens = childrens;
        }

        if (req.body.bankAccountInformation) {
            employee.employeeProfile.bankAccountInformation = {
                ...employee.employeeProfile.bankAccountInformation,
                ...req.body.bankAccountInformation,
            };
        }

        const profileImageFile = req.files?.profileImage?.[0];
        const idImageFiles = req.files?.idImages;
        const aadhaarImageFiles = req.files?.aadhaarImages;

        if (profileImageFile) {
            if (employee.employeeProfile.profileImage?.fileUrl) {
                fs.unlink(
                    path.join(
                        process.cwd(),
                        employee.employeeProfile.profileImage.fileUrl
                    ),
                    () => { }
                );
            }

            employee.employeeProfile.profileImage = {
                fileName: profileImageFile.originalname,
                fileUrl: `/uploads/profile-images/${profileImageFile.filename}`,
            };
        }

        if (idImageFiles) {
            employee.employeeProfile.documents.idImages.forEach((doc) => {
                fs.unlink(
                    path.join(process.cwd(), doc.fileUrl),
                    () => { }
                );
            });

            employee.employeeProfile.documents.idImages = idImageFiles.map(
                (file) => ({
                    fileName: file.originalname,
                    fileUrl: `/uploads/id-images/${file.filename}`,
                })
            );
        }

        if (aadhaarImageFiles) {
            employee.employeeProfile.documents.aadhaarImages.forEach((doc) => {
                fs.unlink(
                    path.join(process.cwd(), doc.fileUrl),
                    () => { }
                );
            });

            employee.employeeProfile.documents.aadhaarImages =
                aadhaarImageFiles.map((file) => ({
                    fileName: file.originalname,
                    fileUrl: `/uploads/aadhaar-images/${file.filename}`,
                }));
        }

        await employee.save();

        if (passwordChanged) {
            try {
                const mail = passwordUpdatedTemplate({
                    fullName: `${employee.firstName} ${employee.lastName}`,
                    email: employee.email,
                    password: newPlainPassword,
                    companyName,
                });

                await sendSimpleMail({
                    to: employee.email,
                    subject: mail.subject,
                    html: mail.html,
                    text: mail.text,
                });
            } catch (mailError) {
                console.error("Password email failed:", mailError);
            }
        }

        const result = employee.toObject();
        delete result.password;

        return res.status(200).json({
            message: passwordChanged
                ? "Employee updated and password email sent"
                : "Employee updated successfully",
            data: result,
        });
    } catch (error) {
        console.error("Update employee error:", error);

        if (req.files) {
            const files = [
                ...(req.files.profileImage || []),
                ...(req.files.idImages || []),
                ...(req.files.aadhaarImages || []),
            ];

            files.forEach((file) => {
                fs.unlink(path.join(file.destination, file.filename), () => { });
            });
        }

        return res.status(500).json({
            message: "Failed to update employee",
        });
    }
};


exports.toggleEmployeeDeleteByCompanyAdmin = async (req, res) => {
    try {
        const loggedUser = req.user;

        if (loggedUser.role.name !== "company_admin") {
            return res.status(403).json({
                message: "Only company admin can perform this action",
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid employee id",
            });
        }

        const employee = await User.findOne({
            _id: id,
            company: loggedUser.company,
            isDeleted: { $in: [true, false] },
        }).populate("role");

        if (!employee) {
            return res.status(404).json({
                message: "Employee not found in your company",
            });
        }

        if (employee.role.name !== "employee") {
            return res.status(403).json({
                message: "You can only delete employees",
            });
        }

        // ✅ Get Company
        const company = await Company.findById(loggedUser.company);

        if (!company) {
            return res.status(404).json({
                message: "Company not found",
            });
        }

    
        const plan = await Plan.findById(company.planId);

        if (!plan) {
            return res.status(400).json({
                message: "Company plan not found",
            });
        }

        const newIsDeleted = !employee.isDeleted;

        if (!newIsDeleted) {
            // restore means employee.isDeleted was true → now false

            if (company.currentEmployeeCount >= plan.employeeLimit) {
                return res.status(400).json({
                    message: `Cannot restore employee. Limit reached (${plan.employeeLimit})`,
                });
            }

            await Company.findByIdAndUpdate(company._id, {
                $inc: { currentEmployeeCount: 1 },
            });
        }

        if (newIsDeleted) {
            await Company.findOneAndUpdate(
                { _id: company._id, currentEmployeeCount: { $gt: 0 } },
                { $inc: { currentEmployeeCount: -1 } }
            );
        }

        employee.isDeleted = newIsDeleted;
        await employee.save();

        return res.status(200).json({
            success: true,
            message: newIsDeleted
                ? "Employee deleted successfully"
                : "Employee restored successfully",
            isDeleted: newIsDeleted,
        });
    } catch (error) {
        console.error("Toggle employee delete error:", error);
        return res.status(500).json({
            message: "Failed to update employee status",
        });
    }
};

