import Role from '../models/Role'
import UserRole from '../models/UserRole'
import logger from '../config/logger'

export interface RoleCheckResult {
  ok: boolean
  status: number 
  message: string
}

export const checkAdminRole = async (userId : string) : Promise<RoleCheckResult> => {
  try {
    const userRole = await UserRole.findOne({ userId }).lean()

    if (!userRole) {
      return {
        ok: false,
        status: 404,
        message: 'User role not found'
      } 
    }

    const role = await Role.findById(userRole.roleId).lean()

    if (!role) {
      return {
        ok: false,
        status: 404,
        message: 'Role not found'
      } 
    }

    if (role.name === 'ADMIN') {
      return {
        ok: true,
        status: 200,
        message: 'Admin role is confirmed'
      } 
    }

    return {
      ok: false,
      status: 403,
      message: 'User is not an admin'
    } 
  } catch (err) {
    logger.error(`checkAdminRole failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    return {
      ok: false,
      status: 401,
      message: 'Error while checking admin role'
    } 
  }
}
