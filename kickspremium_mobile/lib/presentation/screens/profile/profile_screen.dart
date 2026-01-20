import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../logic/providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userProvider);
    final profileAsync = ref.watch(userProfileProvider);
    final isLoggedIn = ref.watch(isLoggedInProvider);

    if (!isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('MI CUENTA')),
        body: _buildNotLoggedIn(context),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('MI CUENTA'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  // Avatar
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: Theme.of(context).primaryColor,
                    child: Text(
                      _getInitials(user?.email ?? ''),
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Email
                  Text(
                    user?.email ?? 'Sin email',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  
                  // Profile name
                  profileAsync.when(
                    data: (profile) => profile?['full_name'] != null
                        ? Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              profile!['full_name'],
                              style: const TextStyle(color: Colors.grey),
                            ),
                          )
                        : const SizedBox.shrink(),
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),

                  const SizedBox(height: 8),

                  // Member since
                  if (user?.createdAt != null)
                    Text(
                      'Miembro desde ${_formatDate(user!.createdAt)}',
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Account info section
            _SectionTitle(title: 'Información de cuenta'),
            const SizedBox(height: 12),
            
            _InfoCard(
              children: [
                _InfoRow(
                  label: 'Email',
                  value: user?.email ?? 'Sin especificar',
                ),
                profileAsync.when(
                  data: (profile) => _InfoRow(
                    label: 'Nombre',
                    value: profile?['full_name'] ?? 'No especificado',
                  ),
                  loading: () => const _InfoRow(
                    label: 'Nombre',
                    value: 'Cargando...',
                  ),
                  error: (_, __) => const _InfoRow(
                    label: 'Nombre',
                    value: 'Error',
                  ),
                ),
                _InfoRow(
                  label: 'Miembro desde',
                  value: user?.createdAt != null
                      ? _formatDateLong(user!.createdAt)
                      : 'No disponible',
                  showDivider: false,
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Quick actions
            _SectionTitle(title: 'Acciones rápidas'),
            const SizedBox(height: 12),

            _ActionButton(
              icon: Icons.receipt_long,
              label: 'Mis Pedidos',
              onTap: () => context.push('/orders'),
            ),
            
            _ActionButton(
              icon: Icons.shopping_bag,
              label: 'Ver Carrito',
              onTap: () => context.push('/cart'),
            ),

            _ActionButton(
              icon: Icons.explore,
              label: 'Explorar Productos',
              onTap: () => context.go('/'),
            ),

            const SizedBox(height: 24),

            // Logout button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _handleLogout(context, ref),
                icon: const Icon(Icons.logout, color: Colors.red),
                label: const Text(
                  'CERRAR SESIÓN',
                  style: TextStyle(color: Colors.red),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.red),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildNotLoggedIn(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.account_circle_outlined,
              size: 80,
              color: Colors.grey[600],
            ),
            const SizedBox(height: 24),
            Text(
              'Inicia sesión para acceder a tu cuenta',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: Colors.grey,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () => context.push('/login?redirect=/profile'),
              child: const Text('INICIAR SESIÓN'),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => context.push('/register'),
              child: const Text('CREAR CUENTA'),
            ),
          ],
        ),
      ),
    );
  }

  String _getInitials(String email) {
    if (email.isEmpty) return '?';
    return email[0].toUpperCase();
  }

  String _formatDate(String dateString) {
    final date = DateTime.parse(dateString);
    return DateFormat('MMM yyyy', 'es_ES').format(date);
  }

  String _formatDateLong(String dateString) {
    final date = DateTime.parse(dateString);
    return DateFormat('d MMMM yyyy', 'es_ES').format(date);
  }

  void _handleLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1C1C1C),
        title: const Text('Cerrar sesión'),
        content: const Text('¿Estás seguro de que quieres cerrar sesión?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('CANCELAR'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'CERRAR SESIÓN',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(authRepositoryProvider).signOut();
      ref.read(cartProvider.notifier).clearCart();
      if (context.mounted) {
        context.go('/');
      }
    }
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title.toUpperCase(),
      style: const TextStyle(
        color: Colors.grey,
        fontSize: 12,
        fontWeight: FontWeight.bold,
        letterSpacing: 1,
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;

  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool showDivider;

  const _InfoRow({
    required this.label,
    required this.value,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(color: Colors.grey),
              ),
              Flexible(
                child: Text(
                  value,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          const Divider(height: 1, color: Color(0xFF2A2A2A)),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(icon, color: Theme.of(context).primaryColor),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.grey),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
