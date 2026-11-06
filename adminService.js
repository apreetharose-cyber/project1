const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const equipmentModel = require('../models/equipmentModel');
const kycModel = require('../models/kycModel');
const bookingModel = require('../models/bookingModel');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

const adminService = {
  async login(email, password) {
    const user = await userModel.findByEmail(email);
    if (!user || user.role !== 'ADMIN' || !user.password_hash) throw new AppError('Invalid admin credentials.', 401);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new AppError('Invalid admin credentials.', 401);

    const token = signToken({ id: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.full_name, email: user.email, role: user.role } };
  },

  async getDashboardStats() {
    const [totalUsers, farmers, equipmentOwners, farmLabour, totalEquipment, pendingKyc, totalBookings] = await Promise.all([
      userModel.countAllNonAdmin(),
      userModel.countByRole('FARMER'),
      userModel.countByRole('EQUIPMENT_OWNER'),
      userModel.countByRole('FARM_LABOUR'),
      equipmentModel.countAll(),
      kycModel.countByStatus('PENDING'),
      bookingModel.countAll(),
    ]);
    return { totalUsers, farmers, equipmentOwners, farmLabour, totalEquipment, pendingKyc, totalBookings };
  },

  async getUsers(filters) {
    const rows = await userModel.listWithFilters(filters);
    return rows.map((r) => ({ id: r.id, name: r.full_name, email: r.email, mobile: r.mobile, role: r.role, kycStatus: r.kyc_status, accountStatus: r.account_status }));
  },

  async setAccountStatus(userId, status) { await userModel.setAccountStatus(userId, status); },
};

module.exports = adminService;