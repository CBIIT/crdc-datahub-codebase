class SimpleCipher:
    def __init__(self, key):
        assert isinstance(key, int)
        self.key = key

    def _cipher(self, data, key):
        '''
        Caesar Cipher algorithm, only works for strings contain only alphanumeric characters
        Won't work with string contains letters

        :param data: string to be ciphered, can only contain numbers
        :param key: cipher key, should be integer
        :return: ciphered string
        '''
        assert isinstance(data, str)
        assert isinstance(key, int)
        result = ''
        for c in data:
            try:
                num = int(c)
                enc = (num + key) % 10
            except ValueError:
                if 'A' <= c <= 'Z':
                    num = ord(c) - ord('A')
                    enc_num = (num + key) % 26 + ord('A')
                    enc = chr(enc_num)
                elif 'a' <= c <= 'z':
                    num = ord(c) - ord('a')
                    enc_num = (num + key) % 26 + ord('a')
                    enc = chr(enc_num)
                else:
                    raise Exception(f'"{c}" is not a alphanumeric character!')
            result += str(enc)

        return result

    def simple_cipher(self, data):
        '''
        Use key given in constructor to do Caesar Cipher

        :param data: string to be ciphered, can only contain alphanumeric characters
        :return: ciphered string
        '''
        assert isinstance(data, str)
        return self._cipher(data, self.key)

    def simple_decipher(self, data):
        '''
        Use key given in constructor to decode a Caesar Ciphered data

        :param data: string to be deciphered, can only contain alphanumeric characters
        :return: deciphered original string
        '''
        assert isinstance(data, str)
        return self._cipher(data, -self.key)
