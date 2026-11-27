import { Router } from 'express';
import { adminRouter } from './admin.routes.js';
import { authRouter } from './auth.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { ticketRouter } from './ticket.routes.js';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/tickets', ticketRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/admin', adminRouter);
