/// Receipt PDF downloading for the parent app.
///
/// Receipt URLs (`/api/v1/fees/receipts/<id>/pdf`) sit behind the JWT auth
/// header, so they cannot be opened by a browser directly. We GET the bytes
/// through the shared ApiClient (auth interceptor attached), write them to a
/// temp file and hand the local file to the platform viewer via
/// url_launcher — falling back to the raw URL when the local open fails.
library;

import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:aschool_shared/aschool_shared.dart';

/// Downloads [receiptUrl] with the auth header and opens it with the
/// platform PDF viewer. Returns true on success; callers show their own
/// error feedback when it returns false.
Future<bool> openReceiptPdf(String receiptUrl) async {
  final fullUrl = receiptUrl.startsWith('http')
      ? receiptUrl
      // receipt_url already includes the /api/v1 prefix.
      : '${AppConstants.baseUrl}$receiptUrl';
  try {
    final response = await ApiClient.instance.get<List<int>>(
      _clientPath(fullUrl),
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) return false;

    final dir = await Directory.systemTemp.createTemp('aschool_receipts');
    final file = File(
      '${dir.path}/receipt-${DateTime.now().millisecondsSinceEpoch}.pdf',
    );
    await file.writeAsBytes(bytes);

    // Preferred: hand the local file to the platform viewer.
    try {
      final opened = await launchUrl(
        Uri.file(file.path),
        mode: LaunchMode.externalApplication,
      );
      if (opened) return true;
    } catch (e) {
      debugPrint('openReceiptPdf local open failed: $e');
    }

    // Fallback: let the browser try the raw URL (signed/public servers).
    try {
      return await launchUrl(
        Uri.parse(fullUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      debugPrint('openReceiptPdf browser open failed: $e');
      return false;
    }
  } catch (e) {
    debugPrint('openReceiptPdf download failed: $e');
    return false;
  }
}

/// Strips the API version prefix — ApiClient.instance already points at
/// `<base>/api/v1`, so request paths must be relative to it.
String _clientPath(String fullUrl) {
  final path = Uri.parse(fullUrl).path;
  const version = AppConstants.apiVersion; // "/api/v1"
  if (path.startsWith(version)) return path.substring(version.length);
  return path;
}
