import { Request, Response } from 'express';
import path from 'path';
import fbAccountService from '../services/fb-account.service';
import ResponseHandler from '../utils/response-handler';

export class DashboardController {
  
  // Serve dashboard HTML
  async renderDashboard(req: Request, res: Response): Promise<void> {
    try {
      res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      res.status(500).send('Error loading dashboard');
    }
  }

  // Get system statistics
  async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      // Get total accounts
      const allAccounts = await fbAccountService.getAllAccounts({
        page: 1,
        limit: 1
      });

      // Get accounts by status
      const activeAccounts = await fbAccountService.getAllAccounts({
        status: 'Active',
        page: 1,
        limit: 1
      });

      const checkpointAccounts = await fbAccountService.getAllAccounts({
        status: 'Checkpoint',
        page: 1,
        limit: 1
      });

      const lockedAccounts = await fbAccountService.getAllAccounts({
        status: 'Locked',
        page: 1,
        limit: 1
      });

      const disabledAccounts = await fbAccountService.getAllAccounts({
        status: 'Disabled',
        page: 1,
        limit: 1
      });

      // Get accounts with friend suggestion
      const friendSuggestionAccounts = await fbAccountService.getAllAccounts({
        friend_suggestion: 'Yes',
        page: 1,
        limit: 1
      });

      const stats = {
        total: allAccounts.pagination.total,
        active: activeAccounts.pagination.total,
        checkpoint: checkpointAccounts.pagination.total,
        locked: lockedAccounts.pagination.total,
        disabled: disabledAccounts.pagination.total,
        friend_suggestion_enabled: friendSuggestionAccounts.pagination.total,
        last_updated: new Date().toISOString()
      };

      ResponseHandler.success(res, stats, 'System statistics retrieved successfully');
    } catch (error) {
      console.error('Error fetching system stats:', error);
      ResponseHandler.internalError(res, 'Failed to fetch system statistics');
    }
  }

  // Get system health
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        version: '1.0.0'
      };

      ResponseHandler.success(res, health, 'System health check passed');
    } catch (error) {
      console.error('Error checking system health:', error);
      ResponseHandler.internalError(res, 'Health check failed');
    }
  }

  // Get system info
  async getSystemInfo(req: Request, res: Response): Promise<void> {
    try {
      const info = {
        name: 'FB Account Manager API',
        version: '1.0.0',
        description: 'Professional Facebook Account Management System',
        endpoints: {
          dashboard: '/',
          api_docs: '/api-docs',
          api_base: '/api/fb-accounts',
          system_stats: '/system/stats',
          system_health: '/system/health'
        },
        features: [
          'CRUD Operations',
          'Advanced Filtering',
          'Pagination',
          'Bulk Operations',
          'Auto-Generated Swagger Docs',
          'Standard Response Format',
          'Type-Safe with TypeScript'
        ],
        database: {
          type: 'MySQL',
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'fb_account_manager'
        },
        timestamp: new Date().toISOString()
      };

      ResponseHandler.success(res, info, 'System information retrieved');
    } catch (error) {
      console.error('Error fetching system info:', error);
      ResponseHandler.internalError(res, 'Failed to fetch system information');
    }
  }
}

export default new DashboardController();