import { Request, Response, NextFunction } from 'express';

export const validateStudent = (req: Request, res: Response, next: NextFunction) => {
  const { name, student_id, grade, section, parent_email, parent_phone, parent_name, existingParentId } = req.body;

  if (!name || !student_id || !grade || !section) {
    return res.status(400).json({
      success: false,
      message: 'Missing required student fields. Required: name, student_id, grade, section',
    });
  }

  if (!existingParentId) {
    if (!parent_email || !parent_phone || !parent_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parent fields. Required: parent_email, parent_phone, parent_name',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parent_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent email format',
      });
    }
  }

  next();
};

export const validateAttendance = (req: Request, res: Response, next: NextFunction) => {
  let { studentId, status, session } = req.body;

  if (!studentId || !status) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields. Required: studentId, status',
    });
  }

  // Normalize status to Title Case (Present, Absent, etc.)
  req.body.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  // Normalize session to lowercase for consistent DB storage.
  // All code (frontend filters, service layer) compares using lowercase.
  if (!session) {
    req.body.session = null;
  } else {
    req.body.session = session.toLowerCase();
  }

  // Validate status
  const validStatuses = ['Present', 'Absent', 'Late', 'Excused'];
  if (!validStatuses.includes(req.body.status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  // Validate session (lowercase)
  if (req.body.session !== null && !['morning', 'afternoon'].includes(req.body.session)) {
    return res.status(400).json({
      success: false,
      message: `Invalid session. Must be one of: morning, afternoon`,
    });
  }

  next();
};

export const validateSignup = (req: Request, res: Response, next: NextFunction) => {
  const { email, password, name, schoolName, schoolAddress, phone } = req.body;

  if (!email || !password || !name || !schoolName) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields. Required: email, password, name, schoolName',
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
    });
  }

  // Password strength: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long.',
    });
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return res.status(400).json({
      success: false,
      message: 'Password must contain at least 1 uppercase letter (A–Z), 1 lowercase letter (a–z), and 1 number (0–9).',
    });
  }

  if (name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Admin name must be at least 2 characters',
    });
  }

  if (schoolName.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'School name must be at least 3 characters',
    });
  }

  next();
};

