/// Centralized File Upload Service
/// All uploads go through /files/upload so they are organized and visible
/// in the admin panel's Media Library, organized by module/folder.
library;

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'api_client.dart';

class UploadedFile {
  final String id;
  final String fileUrl;
  final String originalName;
  final String fileType; // image, document, video, etc.
  final int? fileSize;
  final String? mimeType;

  const UploadedFile({
    required this.id,
    required this.fileUrl,
    required this.originalName,
    required this.fileType,
    this.fileSize,
    this.mimeType,
  });

  bool get isImage => fileType == 'image';
  bool get isPdf => originalName.endsWith('.pdf') || mimeType == 'application/pdf';
  bool get isVideo => fileType == 'video';

  factory UploadedFile.fromJson(Map<String, dynamic> json) {
    return UploadedFile(
      id: json['id']?.toString() ?? '',
      fileUrl: json['url'] as String? ?? json['file_url'] as String? ?? '',
      originalName: json['original_name'] as String? ?? json['name'] as String? ?? 'file',
      fileType: json['file_type'] as String? ?? 'other',
      fileSize: (json['file_size'] as num?)?.toInt(),
      mimeType: json['mime_type'] as String?,
    );
  }
}

/// Defines which module the file belongs to (for admin media library organization)
enum UploadModule {
  assignments,
  lms,
  notices,
  announcements,
  chat,
  gallery,
  other;

  String get slug {
    switch (this) {
      case UploadModule.assignments:
        return 'assignments';
      case UploadModule.lms:
        return 'lms';
      case UploadModule.notices:
        return 'notices';
      case UploadModule.announcements:
        return 'announcements';
      case UploadModule.chat:
        return 'chat';
      case UploadModule.gallery:
        return 'gallery';
      case UploadModule.other:
        return 'general';
    }
  }
}

class FileUploadService {
  FileUploadService._();
  static final FileUploadService _instance = FileUploadService._();
  static FileUploadService get instance => _instance;

  final _picker = ImagePicker();

  /// Pick image from gallery or camera and upload to centralized storage
  Future<UploadedFile?> pickAndUploadImage({
    required UploadModule module,
    String? linkedEntityId,
    String? folderId,
    ImageSource source = ImageSource.gallery,
    void Function(double progress)? onProgress,
  }) async {
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 85,
    );
    if (picked == null) return null;
    return _uploadFile(
      file: File(picked.path),
      filename: picked.name,
      module: module,
      linkedEntityId: linkedEntityId,
      folderId: folderId,
      onProgress: onProgress,
    );
  }

  /// Pick any file type and upload
  Future<UploadedFile?> pickAndUploadFile({
    required UploadModule module,
    String? linkedEntityId,
    String? folderId,
    void Function(double progress)? onProgress,
  }) async {
    // Use image_picker for images, fallback for general files
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return null;
    return _uploadFile(
      file: File(picked.path),
      filename: picked.name,
      module: module,
      linkedEntityId: linkedEntityId,
      folderId: folderId,
      onProgress: onProgress,
    );
  }

  /// Upload a file directly from a path
  Future<UploadedFile?> uploadFromPath({
    required String filePath,
    required String filename,
    required UploadModule module,
    String? linkedEntityId,
    String? folderId,
    void Function(double progress)? onProgress,
  }) {
    return _uploadFile(
      file: File(filePath),
      filename: filename,
      module: module,
      linkedEntityId: linkedEntityId,
      folderId: folderId,
      onProgress: onProgress,
    );
  }

  Future<UploadedFile?> _uploadFile({
    required File file,
    required String filename,
    required UploadModule module,
    String? linkedEntityId,
    String? folderId,
    void Function(double progress)? onProgress,
  }) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: filename),
        'linked_module': module.slug,
        if (linkedEntityId != null) 'linked_entity_id': linkedEntityId,
        if (folderId != null) 'folder_id': folderId,
        'is_public': 'true',
      });

      final response = await ApiClient.instance.post(
        '/files/upload',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
        onSendProgress: onProgress != null
            ? (sent, total) {
                if (total > 0) onProgress(sent / total);
              }
            : null,
      );

      final data = response.data;
      if (data['success'] == true) {
        final files = data['data'];
        if (files is List && files.isNotEmpty) {
          return UploadedFile.fromJson(Map<String, dynamic>.from(files.first));
        }
        if (files is Map) {
          return UploadedFile.fromJson(Map<String, dynamic>.from(files));
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
