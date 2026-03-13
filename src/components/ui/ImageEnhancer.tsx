"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Eraser,
  ZoomIn,
  Crop,
  ImagePlus,
  Loader2,
  Check,
  X,
  ArrowRight,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";

interface AIPricing {
  upscale: number;
  remove_bg: number;
  enhance: number;
  auto_crop: number;
  generate: number;
  currency: string;
}

interface ImageEnhancerProps {
  imageUrl: string;
  onEnhanced: (newUrl: string) => void;
  onClose: () => void;
  productName?: string;
}

type EnhancementType = "upscale" | "remove_bg" | "enhance" | "auto_crop";

interface EnhancementOption {
  type: EnhancementType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ENHANCEMENT_OPTIONS: EnhancementOption[] = [
  {
    type: "enhance",
    label: "Auto Enhance",
    description: "Improve clarity, colors, and lighting",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    type: "upscale",
    label: "Upscale",
    description: "Increase resolution 2x",
    icon: <ZoomIn className="w-4 h-4" />,
  },
  {
    type: "remove_bg",
    label: "Remove Background",
    description: "Isolate product on transparent background",
    icon: <Eraser className="w-4 h-4" />,
  },
  {
    type: "auto_crop",
    label: "Auto Crop",
    description: "Smart crop to product bounds",
    icon: <Crop className="w-4 h-4" />,
  },
];

export default function ImageEnhancer({
  imageUrl,
  onEnhanced,
  onClose,
  productName,
}: ImageEnhancerProps) {
  const { token } = useAuth();
  const [pricing, setPricing] = useState<AIPricing | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");

  // Fetch pricing on mount
  useEffect(() => {
    fetch("/api/ai/pricing")
      .then((res) => res.json())
      .then((data) => setPricing(data))
      .catch(() => {
        // Fallback pricing
        setPricing({
          upscale: 5,
          remove_bg: 3,
          enhance: 5,
          auto_crop: 1,
          generate: 10,
          currency: "NLe",
        });
      });
  }, []);

  const handleEnhance = useCallback(
    async (type: EnhancementType) => {
      if (!token || processing) return;
      setError(null);
      setProcessing(true);
      setProcessingType(type);

      try {
        const res = await fetch("/api/ai/enhance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            image_url: enhancedUrl || imageUrl,
            enhancement_type: type,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 402) {
            throw new Error(
              "Insufficient wallet balance. Please top up your wallet to use AI features."
            );
          }
          throw new Error(data.error || "Enhancement failed");
        }

        setEnhancedUrl(data.enhanced_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Enhancement failed");
      } finally {
        setProcessing(false);
        setProcessingType(null);
      }
    },
    [token, processing, enhancedUrl, imageUrl]
  );

  const handleGenerate = useCallback(async () => {
    if (!token || processing || !generatePrompt.trim()) return;
    setError(null);
    setProcessing(true);
    setProcessingType("generate");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: generatePrompt.trim(),
          product_name: productName || "Product",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          throw new Error(
            "Insufficient wallet balance. Please top up your wallet to use AI features."
          );
        }
        throw new Error(data.error || "Generation failed");
      }

      setEnhancedUrl(data.generated_url);
      setShowGenerate(false);
      setGeneratePrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setProcessing(false);
      setProcessingType(null);
    }
  }, [token, processing, generatePrompt, productName]);

  const handleAccept = () => {
    if (enhancedUrl) {
      onEnhanced(enhancedUrl);
    }
  };

  const handleReset = () => {
    setEnhancedUrl(null);
    setError(null);
  };

  const getPrice = (type: string): number => {
    if (!pricing) return 0;
    return (pricing as unknown as Record<string, number>)[type] ?? 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">AI Image Enhancer</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
            disabled={processing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          {/* Image Comparison */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Original
                </p>
                <div className="aspect-square bg-gray-50 rounded-lg border overflow-hidden flex items-center justify-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Original"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-gray-400 text-sm">No image</div>
                  )}
                </div>
              </div>

              {/* Enhanced / Result */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {enhancedUrl ? "Enhanced" : "Result"}
                  </p>
                  {enhancedUrl && (
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      disabled={processing}
                    >
                      <Undo2 className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                </div>
                <div className="aspect-square bg-gray-50 rounded-lg border overflow-hidden flex items-center justify-center relative">
                  {processing ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                      <p className="text-sm text-gray-500">
                        {processingType === "generate"
                          ? "Generating image..."
                          : "Enhancing image..."}
                      </p>
                      <p className="text-xs text-gray-400">
                        This may take up to 30 seconds
                      </p>
                    </div>
                  ) : enhancedUrl ? (
                    <img
                      src={enhancedUrl}
                      alt="Enhanced"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-gray-400 text-sm text-center px-4">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      Select an enhancement option below
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Enhancement Options */}
          <div className="px-6 pb-4">
            {!showGenerate ? (
              <>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Enhancement Options
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ENHANCEMENT_OPTIONS.map((option) => {
                    const price = getPrice(option.type);
                    const isActive = processingType === option.type;
                    return (
                      <button
                        key={option.type}
                        onClick={() => handleEnhance(option.type)}
                        disabled={processing || !imageUrl}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                          isActive
                            ? "border-purple-300 bg-purple-50"
                            : "border-gray-200 hover:border-purple-200 hover:bg-purple-50/50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div
                          className={`p-2 rounded-full ${
                            isActive
                              ? "bg-purple-100 text-purple-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {isActive ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            option.icon
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-800">
                          {option.label}
                        </span>
                        <span className="text-[10px] text-gray-500 leading-tight">
                          {option.description}
                        </span>
                        <span className="text-xs font-semibold text-purple-600">
                          {formatCurrency(price)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Generate Option */}
                <button
                  onClick={() => setShowGenerate(true)}
                  disabled={processing}
                  className="mt-3 w-full flex items-center justify-between p-3 rounded-lg border border-dashed border-gray-300 hover:border-purple-300 hover:bg-purple-50/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600">
                      <ImagePlus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-800">
                        Generate New Image
                      </p>
                      <p className="text-xs text-gray-500">
                        Create a product photo from a text description
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatCurrency(getPrice("generate"))}
                  </span>
                </button>
              </>
            ) : (
              /* Generate Form */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-700">
                    Generate New Image
                  </p>
                  <button
                    onClick={() => {
                      setShowGenerate(false);
                      setGeneratePrompt("");
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                    disabled={processing}
                  >
                    Back to options
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Describe the image you want (min 5 characters)
                    </label>
                    <textarea
                      value={generatePrompt}
                      onChange={(e) => setGeneratePrompt(e.target.value)}
                      placeholder={`e.g. "A sleek modern ${productName || "product"} shot on a marble surface with soft natural lighting"`}
                      rows={3}
                      maxLength={500}
                      disabled={processing}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {generatePrompt.length}/500
                    </p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={processing || generatePrompt.trim().length < 5}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing && processingType === "generate" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-4 h-4" />
                        Generate ({formatCurrency(getPrice("generate"))})
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Charges are deducted from your Peeap wallet
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              {enhancedUrl && (
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Use This Image
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
