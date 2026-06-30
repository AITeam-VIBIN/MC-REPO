import { UserResponseDto } from '../users/users.service.js';

/**
 * Mapper utility to transform raw user database records or models into sanitized response DTOs.
 * Prevents internal password hashes or sensitive telemetry fields from leaking to external clients.
 * 
 * @function userMapper
 * @param {Object} rawUserRecord - Database user record model
 * @returns {UserResponseDto} Sanitized and serialized UserResponseDto
 */
export function userMapper(rawUserRecord) {
  return UserResponseDto.fromRecord(rawUserRecord);
}

export default {
  userMapper,
};
