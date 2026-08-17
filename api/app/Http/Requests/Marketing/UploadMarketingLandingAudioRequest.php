<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class UploadMarketingLandingAudioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'audio' => [
                'required',
                'file',
                'max:15360',
                'mimes:mp3,mpga,mpeg,wav,m4a,aac,ogg,webm',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'audio.required' => 'Vui lòng chọn bản ghi âm.',
            'audio.file' => 'File không hợp lệ.',
            'audio.max' => 'Bản ghi tối đa 15MB.',
            'audio.mimes' => 'Chỉ nhận MP3, M4A, WAV, AAC, OGG hoặc WEBM.',
        ];
    }
}
