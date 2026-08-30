import 'package:aschool_shared/aschool_shared.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../state/auth_flow_controller.dart';

class _SchoolSearchResult {
  final String name;
  final String slug;
  final String? logoUrl;
  final String? address;

  _SchoolSearchResult({
    required this.name,
    required this.slug,
    this.logoUrl,
    this.address,
  });

  factory _SchoolSearchResult.fromJson(Map<String, dynamic> json) {
    return _SchoolSearchResult(
      name: safeStringOrNull(json['name']) ?? '',
      slug: safeStringOrNull(json['slug']) ?? '',
      logoUrl: safeStringOrNull(json['logo_url']),
      address: safeStringOrNull(json['address']),
    );
  }
}

class SchoolSelectionScreen extends StatefulWidget {
  final LoginFlow selectedFlow;
  final Future<void> Function(String slug, String name) onSchoolSelected;
  final VoidCallback onBack;
  final String? preselectedSlug;

  const SchoolSelectionScreen({
    super.key,
    required this.selectedFlow,
    required this.onSchoolSelected,
    required this.onBack,
    this.preselectedSlug,
  });

  @override
  State<SchoolSelectionScreen> createState() => _SchoolSelectionScreenState();
}

class _SchoolSelectionScreenState extends State<SchoolSelectionScreen> {
  final _searchController = TextEditingController();
  List<_SchoolSearchResult> _results = [];
  bool _isSearching = false;
  String _errorMessage = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().length < 2) {
      setState(() {
        _results = [];
        _errorMessage = '';
      });
      return;
    }

    setState(() {
      _isSearching = true;
      _errorMessage = '';
    });

    try {
      final response = await ApiClient.instance.get(
        '/schools/lookup',
        queryParameters: {'q': query.trim()},
      );
      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = safeList(response.data['data']);
        setState(() {
          _results = data
              .map((e) => _SchoolSearchResult.fromJson(safeMap(e)))
              .toList();
        });
      } else {
        setState(() => _errorMessage = 'Could not fetch schools. Try again.');
      }
    } on DioException catch (e) {
      setState(() => _errorMessage = 'Search failed: ${e.message}');
    } catch (e) {
      debugPrint('SchoolLookupScreen search failed: $e');
      setState(() => _errorMessage = 'An unexpected error occurred.');
    } finally {
      setState(() => _isSearching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.selectedFlow.accent;

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.white, accent.withValues(alpha: 0.06)],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_rounded),
                        onPressed: widget.onBack,
                      ),
                      Expanded(
                        child: Text(
                          'Find Your School',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: TextField(
                    controller: _searchController,
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'Search by school name…',
                      prefixIcon: _isSearching
                          ? const Padding(
                              padding: EdgeInsets.all(14),
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : const Icon(Icons.search_rounded),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                _search('');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: accent.withValues(alpha: 0.4)),
                      ),
                    ),
                    onChanged: (v) {
                      setState(() {}); // re-render suffixIcon
                      _search(v);
                    },
                  ),
                ),
                if (_errorMessage.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      _errorMessage,
                      style: TextStyle(color: Colors.red[700], fontSize: 13),
                    ),
                  ),
                Expanded(
                  child: _results.isEmpty && !_isSearching
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.school_outlined,
                                    size: 54, color: Colors.grey[400]),
                                const SizedBox(height: 12),
                                Text(
                                  _searchController.text.length < 2
                                      ? 'Type at least 2 letters to search'
                                      : 'No schools found',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(color: Colors.grey[500]),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          itemCount: _results.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final school = _results[index];
                            return _SchoolResultCard(
                              school: school,
                              accent: accent,
                              isSelected: school.slug == widget.preselectedSlug,
                              onTap: () => widget.onSchoolSelected(
                                  school.slug, school.name),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SchoolResultCard extends StatelessWidget {
  final _SchoolSearchResult school;
  final Color accent;
  final bool isSelected;
  final VoidCallback onTap;

  const _SchoolResultCard({
    required this.school,
    required this.accent,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? accent.withValues(alpha: 0.08) : Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected ? accent : Colors.grey[200]!,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              if (school.logoUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    school.logoUrl!,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _schoolInitialAvatar(school.name, accent),
                  ),
                )
              else
                _schoolInitialAvatar(school.name, accent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      school.name,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    if (school.address != null && school.address!.isNotEmpty)
                      Text(
                        school.address!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey[600],
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              Icon(
                isSelected ? Icons.check_circle_rounded : Icons.arrow_forward_ios_rounded,
                color: isSelected ? accent : Colors.grey[400],
                size: isSelected ? 22 : 16,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _schoolInitialAvatar(String name, Color accent) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: accent.withValues(alpha: 0.15),
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'S',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: accent,
            fontSize: 18,
          ),
        ),
      ),
    );
  }
}
