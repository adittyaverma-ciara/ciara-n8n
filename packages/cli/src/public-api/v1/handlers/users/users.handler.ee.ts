import { InviteUsersRequestDto, RoleChangeRequestDto } from '@n8n/api-types';
import { Container } from '@n8n/di';
import type express from 'express';
import type { Response } from 'express';

import { InvitationController } from '@/controllers/invitation.controller';
import { UsersController } from '@/controllers/users.controller';
import { ProjectRelationRepository } from '@/databases/repositories/project-relation.repository';
import { EventService } from '@/events/event.service';
import type { AuthenticatedRequest, UserRequest } from '@/requests';

import { clean, getAllUsersAndCount, getUser } from './users.service.ee';
import {
	globalScope,
	isLicensed,
	validCursor,
	validLicenseWithUserQuota,
} from '../../shared/middlewares/global.middleware';
import { encodeNextCursor } from '../../shared/services/pagination.service';
import { AuthService } from '@/auth/auth.service';
import { JwtService } from '@/services/jwt.service';
import { InvalidAuthTokenRepository } from '@/databases/repositories/invalid-auth-token.repository';

type Create = AuthenticatedRequest<{}, {}, InviteUsersRequestDto>;
type Delete = UserRequest.Delete;
type ChangeRole = AuthenticatedRequest<{ id: string }, {}, RoleChangeRequestDto, {}>;

export = {
	getUserAuth: [
		async (req: UserRequest.GetUserAuth, res: express.Response) => {
			const { id } = req.params;

			const user = await getUser({ withIdentifier: id });

			if (!user) {
				return res.status(404).json({
					message: `Could not find user with id: ${id}`,
				});
			}

			const token = Container.get(AuthService).issueJWT(user);

			return res.json({ user, token });
		},
	],
	revokeUserAuth: [
		async (req: UserRequest.RevokeUserAuth, res: express.Response) => {
			const n8nAuth = req.headers['n8n-auth'] as string;
			if (!n8nAuth) return res.json('ok');

			const { exp } = Container.get(JwtService).decode(n8nAuth);
			if (exp) {
				await Container.get(InvalidAuthTokenRepository).insert({
					token: n8nAuth,
					expiresAt: new Date(exp * 1000),
				});
			}
			return res.json('ok');
		},
	],
	getUser: [
		validLicenseWithUserQuota,
		globalScope('user:read'),
		async (req: UserRequest.Get, res: express.Response) => {
			const { includeRole = false } = req.query;
			const { id } = req.params;

			const user = await getUser({ withIdentifier: id, includeRole });

			if (!user) {
				return res.status(404).json({
					message: `Could not find user with id: ${id}`,
				});
			}

			Container.get(EventService).emit('user-retrieved-user', {
				userId: req.user.id,
				publicApi: true,
			});

			return res.json(clean(user, { includeRole }));
		},
	],
	getUsers: [
		validLicenseWithUserQuota,
		validCursor,
		globalScope(['user:list', 'user:read']),
		async (req: UserRequest.Get, res: express.Response) => {
			const { offset = 0, limit = 100, includeRole = false, projectId } = req.query;

			const _in = projectId
				? await Container.get(ProjectRelationRepository).findUserIdsByProjectId(projectId)
				: undefined;

			const [users, count] = await getAllUsersAndCount({
				includeRole,
				limit,
				offset,
				in: _in,
			});

			Container.get(EventService).emit('user-retrieved-all-users', {
				userId: req.user.id,
				publicApi: true,
			});

			return res.json({
				data: clean(users, { includeRole }),
				nextCursor: encodeNextCursor({
					offset,
					limit,
					numberOfTotalRecords: count,
				}),
			});
		},
	],
	createUser: [
		globalScope('user:create'),
		async (req: Create, res: Response) => {
			const { data, error } = InviteUsersRequestDto.safeParse(req.body);
			if (error) {
				return res.status(400).json(error.errors[0]);
			}

			const usersInvited = await Container.get(InvitationController).inviteUser(
				req,
				res,
				data as InviteUsersRequestDto,
			);
			return res.status(201).json(usersInvited);
		},
	],
	deleteUser: [
		globalScope('user:delete'),
		async (req: Delete, res: Response) => {
			await Container.get(UsersController).deleteUser(req);

			return res.status(204).send();
		},
	],
	changeRole: [
		isLicensed('feat:advancedPermissions'),
		globalScope('user:changeRole'),
		async (req: ChangeRole, res: Response) => {
			const validation = RoleChangeRequestDto.safeParse(req.body);
			if (validation.error) {
				return res.status(400).json({
					message: validation.error.errors[0],
				});
			}

			await Container.get(UsersController).changeGlobalRole(
				req,
				res,
				validation.data,
				req.params.id,
			);

			return res.status(204).send();
		},
	],
};
